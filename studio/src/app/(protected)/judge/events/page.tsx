'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface JudgeEventListItem {
  id: string;
  name: string;
  status: 'upcoming' | 'live' | 'archived';
  start_date: string;
  end_date: string;
}

function toStatusLabel(status: JudgeEventListItem['status']): 'Upcoming' | 'Live' | 'Archived' {
  if (status === 'live') {
    return 'Live';
  }
  if (status === 'archived') {
    return 'Archived';
  }
  return 'Upcoming';
}

function isLiveOrRecent(event: JudgeEventListItem): boolean {
  if (event.status === 'live') {
    return true;
  }

  const recentWindowMs = 14 * 24 * 60 * 60 * 1000;
  const endDate = new Date(event.end_date).getTime();
  if (Number.isNaN(endDate)) {
    return false;
  }

  return Date.now() - endDate <= recentWindowMs;
}

export default function JudgeEventsPage(): React.ReactElement {
  const [events, setEvents] = useState<JudgeEventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/judge/events');
        const payload = await response.json() as { success: boolean; data?: JudgeEventListItem[]; message?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Failed to load assigned judge events.');
        }
        setEvents(payload.data ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load assigned judge events.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadEvents();
  }, []);

  const visibleEvents = useMemo(() => events.filter(isLiveOrRecent), [events]);

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Judge Events</h1>

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
        <table aria-label="Judge Events Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Event</th>
              <th align="left">Status</th>
              <th align="left">Dates</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((event) => (
              <tr key={event.id}>
                <td>{event.name}</td>
                <td>{toStatusLabel(event.status)}</td>
                <td>{new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}</td>
                <td>
                  <a href={`/judge/events/${event.id}`}>View Founder Pitches</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
