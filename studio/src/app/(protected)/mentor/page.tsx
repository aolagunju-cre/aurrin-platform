'use client';

import React, { useEffect, useState } from 'react';

interface MentorDashboardData {
  counts: {
    pending: number;
    accepted: number;
  };
  events: Array<{
    id: string;
    name: string;
    status: string;
    pending: number;
    accepted: number;
  }>;
  matches: Array<{
    id: string;
    mentor_status: 'pending' | 'accepted' | 'declined';
    founder: {
      id: string;
      name: string | null;
      company: string | null;
    };
    event: {
      id: string;
      name: string;
    } | null;
  }>;
}

export default function MentorDashboardPage(): React.ReactElement {
  const [dashboard, setDashboard] = useState<MentorDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setError(null);
      try {
        const response = await fetch('/api/mentor/matches');
        const payload = (await response.json()) as { success: boolean; data?: MentorDashboardData; message?: string };
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message ?? 'Failed to load mentor dashboard.');
        }
        setDashboard(payload.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load mentor dashboard.');
      }
    }

    void load();
  }, []);

  const pendingMatches = dashboard?.matches.filter((match) => match.mentor_status === 'pending') ?? [];
  const acceptedMatches = dashboard?.matches.filter((match) => match.mentor_status === 'accepted') ?? [];

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Mentor Dashboard</h1>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <section aria-label="Mentor Match Counts" style={{ display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0 }}>Pending matches: {dashboard?.counts.pending ?? 0}</p>
        <p style={{ margin: 0 }}>Accepted matches: {dashboard?.counts.accepted ?? 0}</p>
      </section>

      <section aria-label="Assigned Events" style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Assigned Events</h2>
        {(dashboard?.events.length ?? 0) === 0 ? <p style={{ margin: 0 }}>No assigned events yet.</p> : null}
        {dashboard?.events.map((event) => (
          <p key={event.id} style={{ margin: 0 }}>
            {event.name} ({event.status}) - Pending: {event.pending}, Accepted: {event.accepted}
          </p>
        ))}
      </section>

      <section aria-label="Pending Matches" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Pending Matches</h2>
        {pendingMatches.length === 0 ? <p style={{ margin: 0 }}>No pending matches.</p> : null}
        {pendingMatches.map((match) => {
          const founderLabel = match.founder.name ?? match.founder.company ?? 'Founder';
          return (
            <article key={match.id} style={{ border: '1px solid #d6d6d6', padding: '0.75rem' }}>
              <p style={{ margin: 0 }}>{`You've been matched with ${founderLabel}. Accept or decline?`}</p>
              <p style={{ margin: '0.5rem 0 0' }}>
                <a href={`/mentor/matches/${match.id}`}>Review match details</a>
              </p>
            </article>
          );
        })}
      </section>

      <section aria-label="Accepted Matches" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Accepted Matches</h2>
        {acceptedMatches.length === 0 ? <p style={{ margin: 0 }}>No accepted matches.</p> : null}
        {acceptedMatches.map((match) => (
          <article key={match.id} style={{ border: '1px solid #d6d6d6', padding: '0.75rem' }}>
            <p style={{ margin: 0 }}>
              {match.founder.name ?? 'Founder'} {match.founder.company ? `(${match.founder.company})` : ''}
            </p>
            <p style={{ margin: '0.5rem 0 0' }}>
              <a href={`/mentor/matches/${match.id}`}>Open match</a>
            </p>
          </article>
        ))}
      </section>
    </section>
  );
}
