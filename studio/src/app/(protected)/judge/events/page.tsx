'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface JudgeEventListItem {
  id: string;
  name: string;
  status: 'upcoming' | 'live' | 'archived';
  start_date: string;
  end_date: string;
  scoring_start: string | null;
  scoring_end: string | null;
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

  const scoringStatusLabel = useMemo(() => {
    return (event: JudgeEventListItem): string => {
      if (!event.scoring_start || !event.scoring_end) {
        return 'Scoring closed';
      }

      const now = Date.now();
      const scoringStart = Date.parse(event.scoring_start);
      const scoringEnd = Date.parse(event.scoring_end);
      if (Number.isNaN(scoringStart) || Number.isNaN(scoringEnd) || now < scoringStart || now > scoringEnd) {
        return 'Scoring closed';
      }

      return `Scoring open until ${new Date(event.scoring_end).toLocaleString()}`;
    };
  }, []);

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Judge Events</h1>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading assigned events...</p> : null}

      {!isLoading && !error && visibleEvents.length === 0 ? (
        <p className="py-12 text-center text-default-400">No live or recent assigned events available.</p>
      ) : null}

      {!isLoading && !error && visibleEvents.length > 0 ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Judge Events Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Event</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Status</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Dates</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Scoring Window</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((event) => (
                <tr key={event.id} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100 text-foreground">{event.name}</td>
                  <td className="px-4 py-3 border-b border-default-100">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${event.status === 'live' ? 'bg-green-500/10 text-green-400' : event.status === 'upcoming' ? 'bg-violet-500/10 text-violet-400' : 'bg-default-100 text-default-500'}`}>{toStatusLabel(event.status)}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{scoringStatusLabel(event)}</td>
                  <td className="px-4 py-3 border-b border-default-100">
                    <a href={`/judge/events/${event.id}`} className="text-violet-400 hover:text-violet-300 transition-colors">View Founder Pitches</a>
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
