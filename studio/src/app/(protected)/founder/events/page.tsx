'use client';

import React, { useEffect, useMemo, useState } from 'react';

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

function isLiveOrRecent(event: FounderEventListItem): boolean {
  if (event.status === 'live') {
    return true;
  }

  const endDateMs = Date.parse(event.end_date);
  if (Number.isNaN(endDateMs)) {
    return false;
  }

  const recentWindowMs = 14 * 24 * 60 * 60 * 1000;
  return Date.now() - endDateMs <= recentWindowMs;
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
  if (event.scoring_window_open) {
    return 'Judges are scoring';
  }

  return 'Scoring closed, results pending';
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

  const visibleEvents = useMemo(() => events.filter(isLiveOrRecent), [events]);
  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? null,
    [selectedEventId, visibleEvents]
  );

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Founder Events</h1>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading assigned events...</p> : null}

      {!isLoading && !error && visibleEvents.length === 0 ? (
        <p>No live or recent assigned events available.</p>
      ) : null}

      {!isLoading && !error && visibleEvents.length > 0 ? (
        <>
          <table aria-label="Founder Events Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Event</th>
                <th align="left">Scoring Status</th>
                <th align="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.name}</td>
                  <td>{toScoringStatusLabel(event)}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedEventId(event.id)}>
                      View Event Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedEvent ? (
            <section aria-label="Founder Event Detail" style={{ border: '1px solid #e3e3e3', padding: '0.75rem' }}>
              <h2 style={{ marginTop: 0 }}>{selectedEvent.name}</h2>
              <p style={{ margin: '0 0 0.5rem 0' }}>{toScoringStatusLabel(selectedEvent)}</p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                Assigned judges: {selectedEvent.assigned_judges.length}
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                Score progress: {selectedEvent.pitch?.score_progress.submitted ?? 0}/{selectedEvent.pitch?.score_progress.total ?? selectedEvent.assigned_judges.length}
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                Pitch details: {selectedEvent.pitch?.pitch_deck_url ? 'Pitch deck submitted.' : 'No pitch deck uploaded.'}
              </p>

              {!selectedEvent.scores_published ? (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  Scores will be published on {formatDateLabel(selectedEvent.publishing_start)}
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    Aggregated score: {selectedEvent.pitch?.score_aggregate ?? 'N/A'}
                  </p>
                  <pre aria-label="Score Breakdown" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedEvent.pitch?.score_breakdown ?? {}, null, 2)}
                  </pre>
                </>
              )}

              <button type="button" disabled>
                Edit Pitch
              </button>
              <p style={{ margin: '0.5rem 0 0 0' }}>Pitch submission is finalized and cannot be edited.</p>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
