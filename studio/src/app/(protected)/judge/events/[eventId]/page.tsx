'use client';

import React, { useEffect, useState } from 'react';

interface JudgePitchListItem {
  id: string;
  event_id: string;
  founder_id: string;
  pitch_order: number | null;
  company_name: string | null;
  founder_name: string | null;
  founder_email: string | null;
}

interface JudgeEventPitchesPageProps {
  params: Promise<{ eventId: string }>;
}

export default function JudgeEventPitchesPage({ params }: JudgeEventPitchesPageProps): React.ReactElement {
  const [eventId, setEventId] = useState<string>('');
  const [pitches, setPitches] = useState<JudgePitchListItem[]>([]);
  const [scoringWindowOpen, setScoringWindowOpen] = useState(false);
  const [scoringEnd, setScoringEnd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveAndLoad(): Promise<void> {
      const resolvedParams = await params;
      setEventId(resolvedParams.eventId);

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/judge/events/${encodeURIComponent(resolvedParams.eventId)}/pitches`);
        const payload = await response.json() as {
          success: boolean;
          data?: JudgePitchListItem[];
          meta?: { scoring_window_open: boolean; scoring_end: string | null };
          message?: string;
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Failed to load assigned pitches.');
        }
        setPitches(payload.data ?? []);
        setScoringWindowOpen(payload.meta?.scoring_window_open ?? false);
        setScoringEnd(payload.meta?.scoring_end ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load assigned pitches.');
      } finally {
        setIsLoading(false);
      }
    }

    void resolveAndLoad();
  }, [params]);

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Founder Pitches</h1>
      {eventId ? <p style={{ margin: 0 }}>Event: {eventId}</p> : null}
      <p style={{ margin: 0 }}>
        {scoringWindowOpen && scoringEnd ? `Scoring open until ${new Date(scoringEnd).toLocaleString()}` : 'Scoring closed'}
      </p>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading assigned pitches...</p> : null}

      {!isLoading && !error && pitches.length === 0 ? (
        <p>No assigned pitches found for this event.</p>
      ) : null}

      {!isLoading && !error && pitches.length > 0 ? (
        <table aria-label="Judge Event Pitches Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Founder</th>
              <th align="left">Company</th>
              <th align="left">Email</th>
              <th align="left">Pitch Order</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {pitches.map((pitch) => (
              <tr key={pitch.id}>
                <td>{pitch.founder_name ?? 'Founder'}</td>
                <td>{pitch.company_name ?? 'N/A'}</td>
                <td>{pitch.founder_email ?? 'N/A'}</td>
                <td>{pitch.pitch_order ?? 'N/A'}</td>
                <td>
                  {scoringWindowOpen ? (
                    <a href={`/judge/events/${pitch.event_id}/pitch/${pitch.id}`}>Score Pitch</a>
                  ) : (
                    <span>Scoring closed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
