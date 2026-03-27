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
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Pitches</h1>
      {eventId ? <p className="text-sm text-default-500">Event: {eventId}</p> : null}
      <p className="text-sm text-default-500">
        {scoringWindowOpen && scoringEnd ? `Scoring open until ${new Date(scoringEnd).toLocaleString()}` : 'Scoring closed'}
      </p>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading assigned pitches...</p> : null}

      {!isLoading && !error && pitches.length === 0 ? (
        <p className="py-12 text-center text-default-400">No assigned pitches found for this event.</p>
      ) : null}

      {!isLoading && !error && pitches.length > 0 ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Judge Event Pitches Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Founder</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Company</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Email</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Pitch Order</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch) => (
                <tr key={pitch.id} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100 text-foreground">{pitch.founder_name ?? 'Founder'}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{pitch.company_name ?? 'N/A'}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{pitch.founder_email ?? 'N/A'}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{pitch.pitch_order ?? 'N/A'}</td>
                  <td className="px-4 py-3 border-b border-default-100">
                    {scoringWindowOpen ? (
                      <a href={`/judge/events/${pitch.event_id}/pitch/${pitch.id}`} className="text-violet-400 hover:text-violet-300 transition-colors">Score Pitch</a>
                    ) : (
                      <span className="text-default-400">Scoring closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
