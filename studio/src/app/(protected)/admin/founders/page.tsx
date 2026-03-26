'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface FounderListItem {
  id: string;
  name: string;
  email: string;
  application_status: 'Pending' | 'Accepted' | 'Assigned' | 'Declined';
  assigned_event: string | null;
  submission_date: string;
}

type StatusFilter = 'All' | FounderListItem['application_status'];

export default function AdminFoundersPage(): React.ReactElement {
  const [founders, setFounders] = useState<FounderListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadFounders(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/founders');
      const payload = await response.json() as { success: boolean; data?: FounderListItem[]; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load founders.');
      }

      setFounders(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load founders.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFounders();
  }, []);

  const visibleFounders = useMemo(() => {
    if (statusFilter === 'All') {
      return founders;
    }

    return founders.filter((founder) => founder.application_status === statusFilter);
  }, [founders, statusFilter]);

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Founders</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setStatusFilter('Pending')}>Pending</button>
        <button type="button" onClick={() => setStatusFilter('Accepted')}>Accepted</button>
        <button type="button" onClick={() => setStatusFilter('Assigned')}>Assigned</button>
        <button type="button" onClick={() => setStatusFilter('Declined')}>Declined</button>
        <button type="button" onClick={() => setStatusFilter('All')}>All</button>
      </div>

      {error ? (
        <p role="alert" style={{ color: '#b00', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading founder applications...</p> : null}

      {!isLoading ? (
        <table aria-label="Founders Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">name</th>
              <th align="left">email</th>
              <th align="left">application_status</th>
              <th align="left">assigned_event</th>
              <th align="left">submission_date</th>
            </tr>
          </thead>
          <tbody>
            {visibleFounders.map((founder) => (
              <tr key={founder.id}>
                <td>
                  <a href={`/admin/founders/${founder.id}`}>{founder.name}</a>
                </td>
                <td>{founder.email}</td>
                <td>{founder.application_status}</td>
                <td>{founder.assigned_event ?? 'Unassigned'}</td>
                <td>{new Date(founder.submission_date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
