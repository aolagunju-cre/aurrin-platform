'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';

interface FounderPitchSummary {
  id: string;
  pitch_deck_url: string | null;
  score_aggregate: number | null;
  score_breakdown: Record<string, unknown> | null;
  score_progress: {
    submitted: number;
    total: number;
  };
}

interface FounderEventListItem {
  id: string;
  name: string;
  status: 'upcoming' | 'live' | 'archived';
  start_date: string;
  end_date: string;
  scoring_start: string | null;
  scoring_end: string | null;
  publishing_start: string | null;
  scoring_window_open: boolean;
  assigned_judges: string[];
  pitch: FounderPitchSummary | null;
  scores_published: boolean;
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleString();
}

function toScoringStatusLabel(event: FounderEventListItem): string {
  if (event.scores_published) {
    return 'Scores published';
  }

  if (event.scoring_window_open) {
    return 'Judges are scoring';
  }

  return `Scores will be published on ${formatDateLabel(event.publishing_start)}`;
}

export default function FounderEventsPage(): React.ReactElement {
  const [events, setEvents] = useState<FounderEventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/founder/events');
        const payload = await response.json() as { success: boolean; data?: FounderEventListItem[]; message?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Failed to load assigned founder events.');
        }

        const nextEvents = payload.data ?? [];
        setEvents(nextEvents);
        if (nextEvents.length > 0) {
          setSelectedEventId(nextEvents[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load assigned founder events.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadEvents();
  }, []);

  const currentEvents = useMemo(() => events.filter((event) => event.status !== 'archived'), [events]);
  const archivedEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === 'archived')
        .sort((a, b) => Date.parse(b.end_date) - Date.parse(a.end_date)),
    [events]
  );
  const selectedEvent = useMemo(
    () => currentEvents.find((event) => event.id === selectedEventId) ?? currentEvents[0] ?? null,
    [selectedEventId, currentEvents]
  );

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Events</h1>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading assigned events...</p> : null}

      {!isLoading && !error && currentEvents.length === 0 ? (
        <p className="py-12 text-center text-default-400">No active assigned events available.</p>
      ) : null}

      {!isLoading && !error && currentEvents.length > 0 ? (
        <>
          <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
            <table aria-label="Founder Events Table" className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Event</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Status</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Dates</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Scoring Status</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-default-100/50 transition-colors">
                    <td className="px-4 py-3 border-b border-default-100 text-foreground">{event.name}</td>
                    <td className="px-4 py-3 border-b border-default-100">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${event.status === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-violet-500/10 text-violet-400'}`}>{event.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 border-b border-default-100 text-default-500">{toScoringStatusLabel(event)}</td>
                    <td className="px-4 py-3 border-b border-default-100">
                      <a href={`/founder/events/${event.id}/pitch`} className="text-violet-400 hover:text-violet-300 transition-colors">View Pitch Detail</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedEvent ? (
            <section aria-label="Founder Event Detail" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
              <h2 className="text-xl font-semibold text-foreground">{selectedEvent.name}</h2>
              <p className="text-sm text-default-500">{toScoringStatusLabel(selectedEvent)}</p>
              <p className="text-sm text-default-500">Assigned judges: {selectedEvent.assigned_judges.length}</p>
              <p className="text-sm text-default-500">Score progress: {selectedEvent.pitch?.score_progress.submitted ?? 0}/{selectedEvent.pitch?.score_progress.total ?? selectedEvent.assigned_judges.length}</p>
              <p className="text-sm text-default-500">Pitch details: {selectedEvent.pitch?.pitch_deck_url ? 'Pitch deck submitted.' : 'No pitch deck uploaded.'}</p>

              {!selectedEvent.scores_published ? (
                <p className="text-sm text-default-400">Scores will be published on {formatDateLabel(selectedEvent.publishing_start)}</p>
              ) : (
                <>
                  <p className="text-sm text-default-500">Aggregated score: <span className="text-3xl font-bold text-violet-400">{selectedEvent.pitch?.score_aggregate ?? 'N/A'}</span></p>
                  <pre aria-label="Score Breakdown" className="text-xs text-default-400 bg-default-100 rounded-lg p-4 whitespace-pre-wrap">
                    {JSON.stringify(selectedEvent.pitch?.score_breakdown ?? {}, null, 2)}
                  </pre>
                </>
              )}

              <Button isDisabled>
                Edit Pitch
              </Button>
              <p className="text-xs text-default-400">Pitch submission is finalized and cannot be edited.</p>
            </section>
          ) : null}
        </>
      ) : null}

      {!isLoading && !error && (
        <section aria-label="Founder Archive" className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Archive</h2>
          {archivedEvents.length === 0 ? (
            <p className="py-12 text-center text-default-400">No archived pitches yet.</p>
          ) : (
            <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
              <table aria-label="Founder Archive Table" className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Event</th>
                    <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Event Date</th>
                    <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Score</th>
                    <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Validation</th>
                    <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-default-100/50 transition-colors">
                      <td className="px-4 py-3 border-b border-default-100 text-foreground">{event.name}</td>
                      <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(event.end_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 border-b border-default-100 text-default-500">{event.scores_published ? (event.pitch?.score_aggregate ?? 'N/A') : 'Pending publish'}</td>
                      <td className="px-4 py-3 border-b border-default-100 text-default-500">{event.scores_published ? 'Summary available' : 'Pending publish'}</td>
                      <td className="px-4 py-3 border-b border-default-100">
                        <a href={`/founder/events/${event.id}/pitch`} className="text-violet-400 hover:text-violet-300 transition-colors">View Pitch Detail</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
