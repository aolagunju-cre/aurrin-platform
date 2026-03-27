'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';
import ScoreBreakdownCard from '../../../../../../components/founder/ScoreBreakdownCard';
import ValidationSummary from '../../../../../../components/founder/ValidationSummary';

interface PitchPageProps {
  params: Promise<{ eventId: string }>;
}

interface PitchResponse {
  success: boolean;
  message?: string;
  data?: {
    event: {
      id: string;
      name: string;
      publishing_start: string | null;
    };
    pitch: {
      id: string;
      founder_id: string;
      pitch_deck_url: string | null;
      scoring_status: 'judges_scoring' | 'scores_publish_pending' | 'scores_published';
      score_progress: {
        submitted: number;
        total: number;
      };
      score_aggregate: number | null;
      score_breakdown: Record<string, number> | null;
      scores_published: boolean;
    };
  };
}

interface ScoresResponse {
  success: boolean;
  data?: {
    aggregate: {
      total_score: number | null;
      category_breakdown: Record<string, number> | null;
    };
    per_judge: Array<{
      judge_id: string;
      judge_name: string | null;
      total_score: number | null;
      category_scores: Record<string, number> | null;
      comments: string | null;
    }>;
  };
}

interface ValidationResponse {
  success: boolean;
  data?: {
    summary: {
      total_responses: number;
      aggregate_score: number | null;
      by_question: Array<{
        question_id: string;
        response_count: number;
        numeric_average: number | null;
        percentages: Record<string, number>;
        text_summary: string[];
      }>;
    };
  };
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return 'TBD';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'TBD';
  }

  return parsed.toLocaleString();
}

function toScoringStatusText(status: 'judges_scoring' | 'scores_publish_pending' | 'scores_published', publishDate: string | null): string {
  if (status === 'scores_published') {
    return 'Scores published';
  }
  if (status === 'scores_publish_pending') {
    return `Scores will be published on ${formatDateLabel(publishDate)}`;
  }
  return 'Judges are scoring';
}

export default function FounderPitchDetailPage({ params }: PitchPageProps): React.ReactElement {
  const [eventId, setEventId] = useState<string>('');
  const [pitchData, setPitchData] = useState<PitchResponse['data'] | null>(null);
  const [scoresData, setScoresData] = useState<ScoresResponse['data'] | null>(null);
  const [validationData, setValidationData] = useState<ValidationResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const resolved = await params;
        if (!active) {
          return;
        }
        setEventId(resolved.eventId);

        const pitchResponse = await fetch(`/api/founder/events/${resolved.eventId}/pitch`);
        const pitchPayload = (await pitchResponse.json()) as PitchResponse;
        if (!pitchResponse.ok || !pitchPayload.success || !pitchPayload.data) {
          throw new Error(pitchPayload.message || 'Failed to load founder pitch detail.');
        }

        if (!active) {
          return;
        }
        setPitchData(pitchPayload.data);

        if (!pitchPayload.data.pitch.scores_published) {
          setScoresData(null);
          setValidationData(null);
          return;
        }

        const [scoresResponse, validationResponse] = await Promise.all([
          fetch(`/api/founder/events/${resolved.eventId}/scores`),
          fetch(`/api/founder/events/${resolved.eventId}/validation`),
        ]);

        const scoresPayload = (await scoresResponse.json()) as ScoresResponse;
        const validationPayload = (await validationResponse.json()) as ValidationResponse;

        if (!scoresResponse.ok || !scoresPayload.success) {
          throw new Error('Failed to load score details.');
        }
        if (!validationResponse.ok || !validationPayload.success) {
          throw new Error('Failed to load validation summary.');
        }

        if (!active) {
          return;
        }
        setScoresData(scoresPayload.data ?? null);
        setValidationData(validationPayload.data ?? null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load founder pitch detail.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [params]);

  const scoringStatusText = useMemo(() => {
    if (!pitchData) {
      return 'Judges are scoring';
    }
    return toScoringStatusText(pitchData.pitch.scoring_status, pitchData.event.publishing_start);
  }, [pitchData]);

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Pitch Detail</h1>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading pitch detail...</p> : null}

      {!isLoading && pitchData ? (
        <>
          <div className="space-y-2 text-sm text-default-500">
            <p>Event: <span className="text-foreground">{pitchData.event.name}</span></p>
            <p>
              Pitch deck: {pitchData.pitch.pitch_deck_url ? <a href={pitchData.pitch.pitch_deck_url} className="text-violet-400 hover:text-violet-300 transition-colors">Download deck</a> : 'No deck uploaded'}
            </p>
            <p>
              Assigned judges: {pitchData.pitch.score_progress.total} ({pitchData.pitch.score_progress.submitted} submitted)
            </p>
          </div>

          <ScoreBreakdownCard
            statusText={scoringStatusText}
            aggregateScore={scoresData?.aggregate.total_score ?? pitchData.pitch.score_aggregate}
            categoryBreakdown={scoresData?.aggregate.category_breakdown ?? pitchData.pitch.score_breakdown}
            perJudgeScores={scoresData?.per_judge ?? []}
          />

          {validationData ? (
            <ValidationSummary
              totalResponses={validationData.summary.total_responses}
              aggregateScore={validationData.summary.aggregate_score}
              byQuestion={validationData.summary.by_question}
            />
          ) : (
            <section aria-label="Validation Summary" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-3">Validation Summary</h2>
              <p className="text-default-400">{scoringStatusText === 'Scores published' ? 'Validation data unavailable.' : scoringStatusText}</p>
            </section>
          )}

          <div className="flex gap-3">
            <Button
              color="secondary"
              onPress={() => {
                window.location.href = `/founder/reports?eventId=${eventId}&pitchId=${pitchData.pitch.id}`;
              }}
            >
              Download Report
            </Button>
            <Button
              color="default"
              variant="flat"
              onPress={() => {
                window.location.href = `/public/founders/${pitchData.pitch.founder_id}`;
              }}
            >
              Share Profile
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
