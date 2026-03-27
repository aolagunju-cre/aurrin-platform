'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Founder Pitch Detail</h1>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading pitch detail...</p> : null}

      {!isLoading && pitchData ? (
        <>
          <p style={{ margin: 0 }}>Event: {pitchData.event.name}</p>
          <p style={{ margin: 0 }}>
            Pitch deck: {pitchData.pitch.pitch_deck_url ? <a href={pitchData.pitch.pitch_deck_url}>Download deck</a> : 'No deck uploaded'}
          </p>
          <p style={{ margin: 0 }}>
            Assigned judges: {pitchData.pitch.score_progress.total} ({pitchData.pitch.score_progress.submitted} submitted)
          </p>

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
            <section aria-label="Validation Summary" style={{ border: '1px solid #e3e3e3', padding: '0.75rem' }}>
              <h2 style={{ marginTop: 0 }}>Validation Summary</h2>
              <p>{scoringStatusText === 'Scores published' ? 'Validation data unavailable.' : scoringStatusText}</p>
            </section>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/founder/reports?eventId=${eventId}&pitchId=${pitchData.pitch.id}`;
              }}
            >
              Download Report
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/public/founders/${pitchData.pitch.founder_id}`;
              }}
            >
              Share Profile
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
