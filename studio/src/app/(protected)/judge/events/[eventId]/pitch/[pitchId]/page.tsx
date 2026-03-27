'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';
import { ScoringForm } from '../../../../../../../components/judge/ScoringForm';
import { calculateTotals, type ScoreTotals, type ScoringResponses, type ScoringRubricVersion } from '../../../../../../../lib/scoring/calculate';

interface PageParams {
  eventId: string;
  pitchId: string;
}

interface JudgePitchDetail {
  id: string;
  event_id: string;
  founder: {
    company_name: string | null;
    user: {
      name: string | null;
      email: string | null;
    } | null;
  } | null;
}

interface JudgeScoreData {
  score_id: string;
  total_score: number | null;
  breakdown: Record<string, unknown>;
  state: 'draft' | 'submitted' | 'locked';
  responses: ScoringResponses;
  comments: string | null;
  created_at: string;
  submitted_at: string | null;
  locked_at: string | null;
  updated_at: string;
}

interface JudgePitchScoringPageProps {
  params: Promise<PageParams>;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Not available';
  }
  return new Date(value).toLocaleString();
}

export default function JudgePitchScoringPage({ params }: JudgePitchScoringPageProps): React.ReactElement {
  const [resolvedParams, setResolvedParams] = useState<PageParams | null>(null);
  const [pitch, setPitch] = useState<JudgePitchDetail | null>(null);
  const [rubric, setRubric] = useState<ScoringRubricVersion | null>(null);
  const [score, setScore] = useState<JudgeScoreData | null>(null);
  const [comments, setComments] = useState('');
  const [liveTotals, setLiveTotals] = useState<ScoreTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const isReadOnly = score?.state === 'submitted' || score?.state === 'locked';
  const formInitialResponses = useMemo(() => score?.responses ?? {}, [score?.responses]);
  const formKey = score?.updated_at ?? 'new-score';

  const loadPageData = useCallback(async (page: PageParams): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [pitchResponse, scoreResponse] = await Promise.all([
        fetch(`/api/judge/pitches/${encodeURIComponent(page.pitchId)}`),
        fetch(`/api/judge/pitches/${encodeURIComponent(page.pitchId)}/score`),
      ]);

      const pitchPayload = await pitchResponse.json() as {
        success: boolean;
        data?: { pitch: JudgePitchDetail; rubric: ScoringRubricVersion };
        message?: string;
      };
      if (!pitchResponse.ok || !pitchPayload.success || !pitchPayload.data) {
        throw new Error(pitchPayload.message || 'Failed to load pitch scoring details.');
      }

      const scorePayload = await scoreResponse.json() as {
        success: boolean;
        data?: JudgeScoreData | null;
        message?: string;
      };
      if (!scoreResponse.ok || !scorePayload.success) {
        throw new Error(scorePayload.message || 'Failed to load current score.');
      }

      setPitch(pitchPayload.data.pitch);
      setRubric(pitchPayload.data.rubric);
      setScore(scorePayload.data ?? null);
      setComments(scorePayload.data?.comments ?? '');
      setLiveTotals(calculateTotals(scorePayload.data?.responses ?? {}, pitchPayload.data.rubric));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load pitch scoring details.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function resolveAndLoad(): Promise<void> {
      const resolved = await params;
      setResolvedParams(resolved);
      await loadPageData(resolved);
    }

    void resolveAndLoad();
  }, [loadPageData, params]);

  const saveScore = useCallback(async (responses: ScoringResponses, nextState: 'draft' | 'submitted'): Promise<void> => {
    if (!resolvedParams || !rubric) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setConflictMessage(null);

    try {
      const response = await fetch(`/api/judge/pitches/${encodeURIComponent(resolvedParams.pitchId)}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          comments,
          state: nextState,
          updated_at: score?.updated_at,
        }),
      });

      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) {
        if (response.status === 409 && payload.message === 'This score was updated elsewhere') {
          setConflictMessage('This score was updated elsewhere');
          await loadPageData(resolvedParams);
          return;
        }
        throw new Error(payload.message || 'Failed to save score.');
      }

      await loadPageData(resolvedParams);
      setLiveTotals(calculateTotals(responses, rubric));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save score.');
    } finally {
      setIsSaving(false);
    }
  }, [comments, loadPageData, resolvedParams, rubric, score?.updated_at]);

  const revisionRows = useMemo(() => {
    if (!score) {
      return [];
    }

    return [
      { label: 'Created', value: score.created_at },
      { label: 'Last Draft', value: score.updated_at },
      { label: 'Submitted', value: score.submitted_at },
      { label: 'Locked', value: score.locked_at },
    ];
  }, [score]);

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Pitch Scoring</h1>

      {pitch ? (
        <p className="text-sm text-default-500">
          Founder: {pitch.founder?.user?.name ?? 'Founder'} ({pitch.founder?.company_name ?? 'Company'})
        </p>
      ) : null}

      {isReadOnly ? (
        <p role="status" className="text-sm text-default-400">
          This score is {score?.state} and can no longer be edited.
        </p>
      ) : null}

      {conflictMessage ? (
        <p role="alert" className="text-danger">
          {conflictMessage}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading pitch scoring page...</p> : null}

      {!isLoading && !error && rubric ? (
        <>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-default-500">Global Comments</span>
            <textarea
              aria-label="Global Comments"
              rows={4}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              disabled={isReadOnly || isSaving}
              className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            />
          </label>

          <ScoringForm
            key={formKey}
            rubricVersion={rubric}
            initialResponses={formInitialResponses}
            isLoading={isLoading}
            isSubmitting={isSaving}
            readOnly={isReadOnly}
            onSaveDraft={async (responses) => {
              await saveScore(responses, 'draft');
            }}
            onAutoSaveDraft={async (responses) => {
              if (isReadOnly) {
                return;
              }
              await saveScore(responses, 'draft');
            }}
            onSubmitScore={async (responses) => {
              await saveScore(responses, 'submitted');
            }}
            onResponsesChange={(responses, totals) => {
              setLiveTotals(totals);
              if (!score?.state) {
                setLiveTotals(calculateTotals(responses, rubric));
              }
            }}
          />

          <section aria-label="Revision Timeline" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
            <h2 className="text-xl font-semibold text-foreground mb-3">Revision History</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-default-500">
              {revisionRows.map((entry) => (
                <li key={entry.label}>
                  {entry.label}: {formatTimestamp(entry.value)}
                </li>
              ))}
            </ul>
          </section>

          {liveTotals ? (
            <section aria-label="Current Score Summary" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-3">Current Score Summary</h2>
              <p className="text-sm text-default-500 mb-2">Total: <span className="text-3xl font-bold text-violet-400">{liveTotals.total}</span></p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-default-500">
                {liveTotals.breakdown.categories.map((category) => (
                  <li key={category.category}>
                    {category.category}: {category.weighted}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
