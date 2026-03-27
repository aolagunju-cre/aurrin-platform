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
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Founder Dashboard</h1>

      <nav aria-label="Founder Navigation">
        <a href="/founder/profile">Profile</a> | <a href="/founder/events">Events</a> | <a href="/founder/reports">Reports</a>
      </nav>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <section aria-label="Founder Quick Stats" style={{ display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0 }}>Applications submitted: {stats.applications_submitted}</p>
        <p style={{ margin: 0 }}>Active events: {stats.active_events}</p>
        <p style={{ margin: 0 }}>Completed events: {stats.completed_events}</p>
        <p style={{ margin: 0 }}>Accepted mentor matches: {matches.length}</p>
      </section>

      <section aria-label="Mentor Matches" style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Mentor Matches</h2>
        {matches.length === 0 ? (
          <p style={{ margin: 0 }}>No accepted mentor matches available yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {matches.map((match) => (
              <li key={match.id}>
                <strong>{match.mentor.name ?? 'Mentor'}</strong>
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
