'use client';

import React, { useEffect, useMemo, useState } from 'react';

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
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Mentor Match Detail</h1>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading mentor match...</p> : null}

      {!isLoading && detail ? (
        <>
          <p style={{ margin: 0 }}>Founder name: {detail.founder.name ?? 'Not provided'}</p>
          <p style={{ margin: 0 }}>Company: {detail.founder.company ?? 'Not provided'}</p>
          <p style={{ margin: 0 }}>Pitch summary: {detail.founder.pitch_summary ?? 'Not provided'}</p>
          <p style={{ margin: 0 }}>Mentor status: {detail.mentor_status}</p>
          <p style={{ margin: 0 }}>Founder status: {detail.founder_status}</p>
          <p style={{ margin: 0 }}>Aggregate score: {detail.founder.scores.aggregate ?? 'N/A'}</p>

          <section aria-label="Score Breakdown" style={{ display: 'grid', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Score Breakdown</h2>
            {scoreBreakdownLines.length === 0 ? <p style={{ margin: 0 }}>No score breakdown available.</p> : null}
            {scoreBreakdownLines.map((line) => (
              <p key={line} style={{ margin: 0 }}>
                {line}
              </p>
            ))}
          </section>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                void submitAction('accept');
              }}
              disabled={isSubmitting || detail.mentor_status !== 'pending'}
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => {
                void submitAction('decline');
              }}
              disabled={isSubmitting || detail.mentor_status !== 'pending'}
            >
              Decline
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
