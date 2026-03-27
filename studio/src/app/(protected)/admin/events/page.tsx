'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';

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
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Events</h1>
        <Button color="secondary" onPress={() => setShowCreate((current) => !current)}>
          Create Event
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {(['Upcoming', 'Live', 'Archived', 'All'] as const).map((filter) => (
          <Button
            key={filter}
            size="sm"
            variant={statusFilter === filter ? 'solid' : 'flat'}
            color={statusFilter === filter ? 'secondary' : 'default'}
            onPress={() => setStatusFilter(filter)}
          >
            {filter}
          </Button>
        ))}
        <label className="flex items-center gap-2 text-sm text-default-500">
          Sort
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as EventSort)} aria-label="Sort Events" className="rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="date">date</option>
            <option value="name">name</option>
            <option value="status">status</option>
          </select>
        </label>
      </div>

      {showCreate ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
          <label className="block text-sm text-default-500">
            Event Name
            <input
              value={createPayload.name}
              onChange={(event) => setCreatePayload((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </label>
          <label className="block text-sm text-default-500">
            Start Date
            <input
              type="datetime-local"
              value={createPayload.start_date}
              onChange={(event) => setCreatePayload((current) => ({ ...current, start_date: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </label>
          <label className="block text-sm text-default-500">
            End Date
            <input
              type="datetime-local"
              value={createPayload.end_date}
              onChange={(event) => setCreatePayload((current) => ({ ...current, end_date: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </label>
          <Button color="secondary" onPress={() => void handleCreate()} isDisabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading events...</p> : null}

      {!isLoading ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Events Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Name</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Status</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Dates</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Judge count</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Founder count</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((event) => (
                <tr key={event.id} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100">
                    <a href={`/admin/events/${event.id}`} className="text-violet-400 hover:text-violet-300 transition-colors">{event.name}</a>
                  </td>
                  <td className="px-4 py-3 border-b border-default-100">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      event.status === 'Live' ? 'bg-green-500/10 text-green-400' :
                      event.status === 'Upcoming' ? 'bg-violet-500/10 text-violet-400' :
                      'bg-default-100 text-default-500'
                    }`}>{event.status}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{event.judge_count}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{event.founder_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
