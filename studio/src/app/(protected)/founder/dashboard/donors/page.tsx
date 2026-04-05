'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Donation {
  id: string;
  donor_email: string | null;
  donor_user_id: string | null;
  tier_id: string | null;
  tier_label: string | null;
  amount_cents: number;
  stripe_payment_intent_id: string | null;
  status: string;
  created_at: string;
}

function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountCents / 100);
}

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoString));
}

export default function DonorsPage(): React.ReactElement {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/founder/donors');
        const payload = (await res.json()) as { success: boolean; data?: Donation[]; message?: string };
        if (!res.ok || !payload.success) {
          throw new Error(payload.message ?? 'Failed to load donor list.');
        }
        setDonations(payload.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load donor list.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/founder/dashboard" className="text-sm text-default-500 hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Donors</h1>
      </div>

      {isLoading ? (
        <p className="text-default-500">Loading donors…</p>
      ) : error ? (
        <p role="alert" className="text-danger">{error}</p>
      ) : donations.length === 0 ? (
        <div className="rounded-2xl border border-default-200 bg-default-50/70 p-8 text-center">
          <p className="text-default-500">No donations yet.</p>
          <p className="mt-1 text-sm text-default-400">
            Share your founder profile link to start receiving support.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-default-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-default-200 bg-default-50 text-left text-default-600">
                <th className="px-4 py-3 font-medium">Donor</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((donation) => (
                <tr key={donation.id} className="border-b border-default-100 last:border-0">
                  <td className="px-4 py-3 text-foreground">
                    {donation.donor_email ?? 'Anonymous'}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatCurrency(donation.amount_cents)}
                  </td>
                  <td className="px-4 py-3 text-default-500">
                    {donation.tier_label ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-default-500">
                    {formatDate(donation.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
