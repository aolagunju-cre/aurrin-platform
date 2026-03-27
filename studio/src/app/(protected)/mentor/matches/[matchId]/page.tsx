'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';

interface MentorMatchDetailPageProps {
  params: Promise<{ matchId: string }>;
}

interface MentorMatchDetailData {
  id: string;
  mentor_status: 'pending' | 'accepted' | 'declined';
  founder_status: 'pending' | 'accepted' | 'declined';
  founder: {
    id: string;
    name: string | null;
    company: string | null;
    pitch_summary: string | null;
    scores: {
      aggregate: number | null;
      breakdown: Record<string, number> | null;
    };
  };
}

interface MatchDetailResponse {
  success: boolean;
  message?: string;
  data?: MentorMatchDetailData;
}

export default function MentorMatchDetailPage({ params }: MentorMatchDetailPageProps): React.ReactElement {
  const [matchId, setMatchId] = useState<string>('');
  const [detail, setDetail] = useState<MentorMatchDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const resolvedParams = await params;
        if (!active) {
          return;
        }

        setMatchId(resolvedParams.matchId);
        const response = await fetch(`/api/mentor/matches/${resolvedParams.matchId}`);
        const payload = (await response.json()) as MatchDetailResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message ?? 'Failed to load mentor match detail.');
        }
        if (!active) {
          return;
        }
        setDetail(payload.data);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load mentor match detail.');
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

  async function submitAction(action: 'accept' | 'decline'): Promise<void> {
    if (!matchId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/mentor/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: {
          status: 'pending' | 'accepted' | 'declined';
        };
      };
      const responseData = payload.data;
      if (!response.ok || !payload.success || !responseData) {
        throw new Error(payload.message ?? 'Failed to update mentor match status.');
      }
      setDetail((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          mentor_status: responseData.status,
        };
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update mentor match status.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const scoreBreakdownLines = useMemo(() => {
    if (!detail?.founder.scores.breakdown) {
      return [];
    }
    return Object.entries(detail.founder.scores.breakdown).map(([category, value]) => `${category}: ${value}`);
  }, [detail]);

  return (
    <section className="container mx-auto max-w-3xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Mentor Match Detail</h1>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading mentor match...</p> : null}

      {!isLoading && detail ? (
        <>
          <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-2">
            <p className="text-sm text-default-500">Founder name: <span className="text-foreground">{detail.founder.name ?? 'Not provided'}</span></p>
            <p className="text-sm text-default-500">Company: <span className="text-foreground">{detail.founder.company ?? 'Not provided'}</span></p>
            <p className="text-sm text-default-500">Pitch summary: <span className="text-foreground">{detail.founder.pitch_summary ?? 'Not provided'}</span></p>
            <p className="text-sm text-default-500">Mentor status: <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${detail.mentor_status === 'accepted' ? 'bg-green-500/10 text-green-400' : detail.mentor_status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>{detail.mentor_status}</span></p>
            <p className="text-sm text-default-500">Founder status: <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${detail.founder_status === 'accepted' ? 'bg-green-500/10 text-green-400' : detail.founder_status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>{detail.founder_status}</span></p>
            <p className="text-sm text-default-500">Aggregate score: <span className="text-3xl font-bold text-violet-400">{detail.founder.scores.aggregate ?? 'N/A'}</span></p>
          </div>

          <section aria-label="Score Breakdown" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Score Breakdown</h2>
            {scoreBreakdownLines.length === 0 ? <p className="text-default-400">No score breakdown available.</p> : null}
            {scoreBreakdownLines.map((line) => (
              <p key={line} className="text-sm text-default-500">
                {line}
              </p>
            ))}
          </section>

          <div className="flex gap-3">
            <Button
              color="secondary"
              onPress={() => {
                void submitAction('accept');
              }}
              isDisabled={isSubmitting || detail.mentor_status !== 'pending'}
            >
              Accept
            </Button>
            <Button
              color="danger"
              variant="flat"
              onPress={() => {
                void submitAction('decline');
              }}
              isDisabled={isSubmitting || detail.mentor_status !== 'pending'}
            >
              Decline
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
