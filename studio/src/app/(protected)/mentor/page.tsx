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
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Mentor Dashboard</h1>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      <section aria-label="Mentor Match Counts" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
          <p className="text-sm text-default-500">Pending matches</p>
          <p className="text-3xl font-bold text-violet-400">{dashboard?.counts.pending ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
          <p className="text-sm text-default-500">Accepted matches</p>
          <p className="text-3xl font-bold text-violet-400">{dashboard?.counts.accepted ?? 0}</p>
        </div>
      </section>

      <section aria-label="Assigned Events" className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Assigned Events</h2>
        {(dashboard?.events.length ?? 0) === 0 ? <p className="py-12 text-center text-default-400">No assigned events yet.</p> : null}
        {dashboard?.events.map((event) => (
          <p key={event.id} className="text-sm text-default-500">
            {event.name} ({event.status}) - Pending: {event.pending}, Accepted: {event.accepted}
          </p>
        ))}
      </section>

      <section aria-label="Pending Matches" className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Pending Matches</h2>
        {pendingMatches.length === 0 ? <p className="py-12 text-center text-default-400">No pending matches.</p> : null}
        {pendingMatches.map((match) => {
          const founderLabel = match.founder.name ?? match.founder.company ?? 'Founder';
          return (
            <article key={match.id} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
              <p className="text-sm text-default-500">{`You've been matched with ${founderLabel}. Accept or decline?`}</p>
              <p className="mt-2">
                <a href={`/mentor/matches/${match.id}`} className="text-violet-400 hover:text-violet-300 transition-colors">Review match details</a>
              </p>
            </article>
          );
        })}
      </section>

      <section aria-label="Accepted Matches" className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Accepted Matches</h2>
        {acceptedMatches.length === 0 ? <p className="py-12 text-center text-default-400">No accepted matches.</p> : null}
        {acceptedMatches.map((match) => (
          <article key={match.id} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
            <p className="text-sm text-foreground">
              {match.founder.name ?? 'Founder'} {match.founder.company ? `(${match.founder.company})` : ''}
            </p>
            <p className="mt-2">
              <a href={`/mentor/matches/${match.id}`} className="text-violet-400 hover:text-violet-300 transition-colors">Open match</a>
            </p>
          </article>
        ))}
      </section>
    </section>
  );
}
