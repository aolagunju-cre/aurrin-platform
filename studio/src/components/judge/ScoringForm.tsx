'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { calculateTotals, resolveQuestionId } from '../../lib/scoring/calculate';
import type { ScoreTotals, ScoringResponses, ScoringRubricVersion } from '../../lib/scoring/calculate';
import { RubricRenderer } from './RubricRenderer';

interface ScoringFormProps {
  rubricVersion: ScoringRubricVersion;
  initialResponses?: ScoringResponses;
  isLoading?: boolean;
  isSubmitting?: boolean;
  onSaveDraft?: (responses: ScoringResponses) => Promise<void> | void;
  onAutoSaveDraft?: (responses: ScoringResponses) => Promise<void> | void;
  onSubmitScore: (responses: ScoringResponses, totals: ScoreTotals) => Promise<void> | void;
  onResponsesChange?: (responses: ScoringResponses, totals: ScoreTotals) => void;
}

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function buildRequiredErrors(rubricVersion: ScoringRubricVersion, responses: ScoringResponses): Record<string, string> {
  const result: Record<string, string> = {};
  const categories = rubricVersion?.definition?.categories ?? [];

  categories.forEach((category, categoryIndex) => {
    category.questions.forEach((question, questionIndex) => {
      if (!question.required) {
        return;
      }

      const questionId = resolveQuestionId(question, categoryIndex, questionIndex);
      if (isMissingValue(responses[questionId])) {
        result[questionId] = 'This field is required before submit.';
      }
    });
  });

  return result;
}

export function ScoringForm({
  rubricVersion,
  initialResponses = {},
  isLoading = false,
  isSubmitting = false,
  onSaveDraft,
  onAutoSaveDraft,
  onSubmitScore,
  onResponsesChange,
}: ScoringFormProps): React.ReactElement {
  const [responses, setResponses] = useState<ScoringResponses>(initialResponses);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);

  const totals = useMemo(() => calculateTotals(responses, rubricVersion), [responses, rubricVersion]);

  useEffect(() => {
    if (onResponsesChange) {
      onResponsesChange(responses, totals);
    }
  }, [onResponsesChange, responses, totals]);

  useEffect(() => {
    if (!onAutoSaveDraft || isLoading || isSubmitting) {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      setIsSavingDraft(true);
      try {
        await onAutoSaveDraft(responses);
        setLastAutoSavedAt(new Date().toISOString());
      } finally {
        setIsSavingDraft(false);
      }
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [onAutoSaveDraft, responses, isLoading, isSubmitting]);

  function handleResponseChange(questionId: string, value: unknown): void {
    setResponses((current) => ({
      ...current,
      [questionId]: value,
    }));

    setErrors((current) => {
      if (!current[questionId]) {
        return current;
      }

      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  async function handleSaveDraft(): Promise<void> {
    if (!onSaveDraft) {
      return;
    }

    setIsSavingDraft(true);
    try {
      await onSaveDraft(responses);
    } finally {
      setIsSavingDraft(false);
    }
  }

  function handleSubmitRequest(): void {
    const requiredErrors = buildRequiredErrors(rubricVersion, responses);
    setErrors(requiredErrors);
    if (Object.keys(requiredErrors).length > 0) {
      return;
    }

    setIsConfirmOpen(true);
  }

  async function handleConfirmSubmit(): Promise<void> {
    await onSubmitScore(responses, totals);
    setIsConfirmOpen(false);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h1>Scoring Form</h1>

      {isLoading ? <p>Loading scoring form...</p> : null}
      {isSavingDraft ? <p>Saving draft...</p> : null}
      {lastAutoSavedAt ? <p>Auto-saved at {new Date(lastAutoSavedAt).toLocaleTimeString()}</p> : null}

      <p>Total Score: {totals.total}</p>
      <ul aria-label="Category Breakdown" style={{ margin: 0 }}>
        {totals.breakdown.categories.map((entry) => (
          <li key={entry.category}>
            {entry.category}: {entry.weighted}
          </li>
        ))}
      </ul>

      <RubricRenderer
        rubricVersion={rubricVersion}
        responses={responses}
        errors={errors}
        disabled={isLoading || isSubmitting}
        onResponseChange={handleResponseChange}
      />

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" onClick={handleSaveDraft} disabled={isLoading || isSubmitting || isSavingDraft || !onSaveDraft}>
          Save Draft
        </button>
        <button type="button" onClick={handleSubmitRequest} disabled={isLoading || isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Score'}
        </button>
      </div>

      {isConfirmOpen ? (
        <div role="dialog" aria-modal="true" aria-label="Submit Score confirmation">
          <h2>Submit Score</h2>
          <p>Confirm submission. This action should be treated as final in score workflows.</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={handleConfirmSubmit} disabled={isSubmitting}>
              Confirm Submit Score
            </button>
            <button type="button" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
