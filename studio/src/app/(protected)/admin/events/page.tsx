'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface EventListItem {
  id: string;
  name: string;
  status: 'Upcoming' | 'Live' | 'Archived';
  start_date: string;
  end_date: string;
  judge_count: number;
  founder_count: number;
}

type EventSort = 'date' | 'name' | 'status';

interface CreateEventPayload {
  name: string;
  start_date: string;
  end_date: string;
}

export default function AdminEventsPage(): React.ReactElement {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Upcoming' | 'Live' | 'Archived'>('All');
  const [sortBy, setSortBy] = useState<EventSort>('date');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createPayload, setCreatePayload] = useState<CreateEventPayload>({
    name: '',
    start_date: '',
    end_date: '',
  });

  async function loadEvents(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/events');
      const payload = await response.json() as { success: boolean; data?: EventListItem[]; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load events.');
      }
      setEvents(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  const visibleEvents = useMemo(() => {
    const filtered = statusFilter === 'All'
      ? events
      : events.filter((event) => event.status === statusFilter);

    const sorted = [...filtered];
    if (sortBy === 'name') {
      sorted.sort((left, right) => left.name.localeCompare(right.name));
    } else if (sortBy === 'status') {
      sorted.sort((left, right) => left.status.localeCompare(right.status));
    } else {
      sorted.sort((left, right) => new Date(left.start_date).getTime() - new Date(right.start_date).getTime());
    }

    return sorted;
  }, [events, sortBy, statusFilter]);

  async function handleCreate(): Promise<void> {
    if (!createPayload.name.trim() || !createPayload.start_date || !createPayload.end_date) {
      setError('Create Event requires name, start date, and end date.');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createPayload.name,
          start_date: new Date(createPayload.start_date).toISOString(),
          end_date: new Date(createPayload.end_date).toISOString(),
        }),
      });

      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to create event.');
      }

      setShowCreate(false);
      setCreatePayload({ name: '', start_date: '', end_date: '' });
      await loadEvents();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create event.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Events</h1>
        <button type="button" onClick={() => setShowCreate((current) => !current)}>
          Create Event
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setStatusFilter('Upcoming')}>Upcoming</button>
        <button type="button" onClick={() => setStatusFilter('Live')}>Live</button>
        <button type="button" onClick={() => setStatusFilter('Archived')}>Archived</button>
        <button type="button" onClick={() => setStatusFilter('All')}>All</button>
        <label>
          Sort
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as EventSort)} aria-label="Sort Events">
            <option value="date">date</option>
            <option value="name">name</option>
            <option value="status">status</option>
          </select>
        </label>
      </div>

      {showCreate ? (
        <div style={{ display: 'grid', gap: '0.5rem', border: '1px solid #ddd', padding: '0.75rem' }}>
          <label>
            Event Name
            <input
              value={createPayload.name}
              onChange={(event) => setCreatePayload((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            Start Date
            <input
              type="datetime-local"
              value={createPayload.start_date}
              onChange={(event) => setCreatePayload((current) => ({ ...current, start_date: event.target.value }))}
            />
          </label>
          <label>
            End Date
            <input
              type="datetime-local"
              value={createPayload.end_date}
              onChange={(event) => setCreatePayload((current) => ({ ...current, end_date: event.target.value }))}
            />
          </label>
          <button type="button" onClick={() => void handleCreate()} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: '#b00', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading events...</p> : null}

      {!isLoading ? (
        <table aria-label="Events Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">name</th>
              <th align="left">status</th>
              <th align="left">dates</th>
              <th align="left">judge count</th>
              <th align="left">founder count</th>
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((event) => (
              <tr key={event.id}>
                <td>
                  <a href={`/admin/events/${event.id}`}>{event.name}</a>
                </td>
                <td>{event.status}</td>
                <td>{new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}</td>
                <td>{event.judge_count}</td>
                <td>{event.founder_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
