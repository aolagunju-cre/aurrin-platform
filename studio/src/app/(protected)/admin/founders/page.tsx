'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';

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
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Founders</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {(['Pending', 'Accepted', 'Assigned', 'Declined', 'All'] as const).map((filter) => (
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
      </div>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading founder applications...</p> : null}

      {!isLoading ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Founders Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Name</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Email</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Status</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Assigned Event</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Submission Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleFounders.map((founder) => (
                <tr key={founder.id} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100">
                    <a href={`/admin/founders/${founder.id}`} className="text-violet-400 hover:text-violet-300 transition-colors">{founder.name}</a>
                  </td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{founder.email}</td>
                  <td className="px-4 py-3 border-b border-default-100">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      founder.application_status === 'Accepted' ? 'bg-green-500/10 text-green-400' :
                      founder.application_status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' :
                      founder.application_status === 'Assigned' ? 'bg-violet-500/10 text-violet-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>{founder.application_status}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{founder.assigned_event ?? 'Unassigned'}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(founder.submission_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
