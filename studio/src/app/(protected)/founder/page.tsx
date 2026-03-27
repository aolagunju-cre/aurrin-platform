'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface FounderEventSummary {
  id: string;
  status: 'upcoming' | 'live' | 'archived';
}

interface FounderMentorMatchSummary {
  id: string;
  created_at: string;
  mentor: {
    name: string | null;
    title: string | null;
    contact: {
      email: string | null;
    };
  };
}

export default function FounderDashboardPage(): React.ReactElement {
  const [events, setEvents] = useState<FounderEventSummary[]>([]);
  const [matches, setMatches] = useState<FounderMentorMatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setError(null);
      try {
        const [eventsResponse, matchesResponse] = await Promise.all([
          fetch('/api/founder/events'),
          fetch('/api/founder/matches'),
        ]);

        const eventsPayload = (await eventsResponse.json()) as {
          success: boolean;
          data?: FounderEventSummary[];
          message?: string;
        };
        if (!eventsResponse.ok || !eventsPayload.success) {
          throw new Error(eventsPayload.message || 'Failed to load founder dashboard.');
        }

        const matchesPayload = (await matchesResponse.json()) as {
          success: boolean;
          data?: {
            matches?: FounderMentorMatchSummary[];
          };
          message?: string;
        };
        if (!matchesResponse.ok || !matchesPayload.success) {
          throw new Error(matchesPayload.message || 'Failed to load founder mentor matches.');
        }

        setEvents(eventsPayload.data ?? []);
        setMatches(matchesPayload.data?.matches ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load founder dashboard.');
      }
    }

    void load();
  }, []);

  const stats = useMemo(() => {
    const activeEvents = events.filter((event) => event.status === 'live').length;
    const completedEvents = events.filter((event) => event.status === 'archived').length;

    return {
      applications_submitted: events.length,
      active_events: activeEvents,
      completed_events: completedEvents,
    };
  }, [events]);

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Dashboard</h1>

      <nav aria-label="Founder Navigation" className="flex gap-4 text-sm">
        <a href="/founder/profile" className="text-violet-400 hover:text-violet-300 transition-colors">Profile</a>
        <span className="text-default-300">|</span>
        <a href="/founder/events" className="text-violet-400 hover:text-violet-300 transition-colors">Events</a>
        <span className="text-default-300">|</span>
        <a href="/founder/reports" className="text-violet-400 hover:text-violet-300 transition-colors">Reports</a>
      </nav>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      <section aria-label="Founder Quick Stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Applications submitted', value: stats.applications_submitted },
          { label: 'Active events', value: stats.active_events },
          { label: 'Completed events', value: stats.completed_events },
          { label: 'Accepted mentor matches', value: matches.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
            <p className="text-sm text-default-500">{stat.label}</p>
            <p className="text-3xl font-bold text-violet-400">{stat.value}</p>
          </div>
        ))}
      </section>

      <section aria-label="Mentor Matches" className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Mentor Matches</h2>
        {matches.length === 0 ? (
          <p className="py-12 text-center text-default-400">No accepted mentor matches available yet.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-2 text-default-500">
            {matches.map((match) => (
              <li key={match.id}>
                <strong className="text-foreground">{match.mentor.name ?? 'Mentor'}</strong>
                {match.mentor.title ? ` (${match.mentor.title})` : ''}
                {match.mentor.contact.email ? ` — ${match.mentor.contact.email}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
