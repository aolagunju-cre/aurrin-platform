'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { calculateTotals, resolveQuestionId } from '../../lib/scoring/calculate';
import type { ScoreTotals, ScoringResponses, ScoringRubricVersion } from '../../lib/scoring/calculate';
import { Button } from '@heroui/button';
import { RubricRenderer } from './RubricRenderer';

interface ScoringFormProps {
  rubricVersion: ScoringRubricVersion;
  initialResponses?: ScoringResponses;
  isLoading?: boolean;
  isSubmitting?: boolean;
  readOnly?: boolean;
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
  readOnly = false,
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
    if (!onAutoSaveDraft || isLoading || isSubmitting || readOnly) {
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
  }, [onAutoSaveDraft, responses, isLoading, isSubmitting, readOnly]);

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
    if (!onSaveDraft || readOnly) {
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
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold text-foreground">Scoring Form</h1>

      {isLoading ? <p className="text-default-400 text-sm">Loading scoring form...</p> : null}
      {isSavingDraft ? <p className="text-default-400 text-sm animate-pulse">Saving draft...</p> : null}
      {lastAutoSavedAt ? (
        <p className="text-success text-sm">Auto-saved at {new Date(lastAutoSavedAt).toLocaleTimeString()}</p>
      ) : null}

      <div className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10">
        <p className="text-default-600 mb-2">
          Total Score:{' '}
          <span className="text-2xl font-bold text-violet-400">{totals.total}</span>
        </p>
        <ul aria-label="Category Breakdown" className="m-0 list-none pl-0 space-y-1">
          {totals.breakdown.categories.map((entry) => (
            <li
              key={entry.category}
              className="flex items-center justify-between rounded-lg bg-default-100 px-3 py-1.5 text-sm"
            >
              <span className="text-default-600">{entry.category}</span>
              <span className="font-semibold text-violet-400">{entry.weighted}</span>
            </li>
          ))}
        </ul>
      </div>

      <RubricRenderer
        rubricVersion={rubricVersion}
        responses={responses}
        errors={errors}
        disabled={isLoading || isSubmitting || readOnly}
        onResponseChange={handleResponseChange}
      />

      {!readOnly ? (
        <div className="flex gap-3">
          <Button
            color="default"
            variant="bordered"
            onPress={() => void handleSaveDraft()}
            isDisabled={isLoading || isSubmitting || isSavingDraft || !onSaveDraft}
            isLoading={isSavingDraft}
          >
            Save Draft
          </Button>
          <Button
            color="primary"
            onPress={handleSubmitRequest}
            isDisabled={isLoading || isSubmitting}
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Score'}
          </Button>
        </div>
      ) : null}

      {isConfirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Submit Score confirmation"
          className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-2">Submit Score</h2>
          <p className="text-default-600 mb-4">Confirm submission. This action should be treated as final in score workflows.</p>
          <div className="flex gap-3">
            <Button
              color="primary"
              onPress={() => void handleConfirmSubmit()}
              isDisabled={isSubmitting}
            >
              Confirm Submit Score
            </Button>
            <Button
              color="default"
              variant="bordered"
              onPress={() => setIsConfirmOpen(false)}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
