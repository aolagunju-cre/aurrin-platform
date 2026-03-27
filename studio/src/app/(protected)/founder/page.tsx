'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface FounderEventSummary {
  id: string;
  status: 'upcoming' | 'live' | 'archived';
}

export default function FounderDashboardPage(): React.ReactElement {
  const [events, setEvents] = useState<FounderEventSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setError(null);
      try {
        const response = await fetch('/api/founder/events');
        const payload = (await response.json()) as { success: boolean; data?: FounderEventSummary[]; message?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Failed to load founder dashboard.');
        }
        setEvents(payload.data ?? []);
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
      </section>
    </section>
  );
}
