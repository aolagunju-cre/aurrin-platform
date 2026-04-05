'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AdminDonationRecord } from '../../../../lib/db/client';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminDonationsPage(): React.ReactElement {
  const [donations, setDonations] = useState<AdminDonationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDonations(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/donations');
      const payload = await response.json() as { success: boolean; data?: AdminDonationRecord[]; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to load donations.');
      }
      setDonations(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load donations.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDonations();
  }, []);

  const stats = useMemo(() => {
    const total = donations.reduce((sum, d) => sum + d.amount_cents, 0);
    return { count: donations.length, totalCents: total };
  }, [donations]);

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Donations</h1>

      {/* Summary stats */}
      {!isLoading && !error ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 max-w-md">
          <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-5">
            <p className="text-sm text-default-400 mb-1">Total Donations</p>
            <p className="text-2xl font-bold text-foreground">{stats.count}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-5">
            <p className="text-sm text-default-400 mb-1">Total Raised</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalCents)}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading donations...</p> : null}

      {!isLoading && !error ? (
        donations.length === 0 ? (
          <p className="text-default-400">No donations yet.</p>
        ) : (
          <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
            <table aria-label="Donations Table" className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Founder</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Donor</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Email</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Amount</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Tier</th>
                  <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Date</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((donation) => {
                  const donorName = donation.donor_name ?? 'Anonymous';
                  return (
                    <tr key={donation.id} className="hover:bg-default-100/50 transition-colors">
                      <td className="px-4 py-3 border-b border-default-100 text-foreground">
                        {donation.founder_company_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 border-b border-default-100 text-default-500">{donorName}</td>
                      <td className="px-4 py-3 border-b border-default-100 text-default-500">
                        {donation.donor_email ?? '—'}
                      </td>
                      <td className="px-4 py-3 border-b border-default-100 font-medium text-foreground">
                        {formatCurrency(donation.amount_cents)}
                      </td>
                      <td className="px-4 py-3 border-b border-default-100 text-default-500">
                        {donation.tier_label ?? '—'}
                      </td>
                      <td className="px-4 py-3 border-b border-default-100 text-default-500">
                        {formatDate(donation.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}
