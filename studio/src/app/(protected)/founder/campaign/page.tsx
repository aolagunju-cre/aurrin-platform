'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Campaign {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'funded' | 'closed';
  funding_goal_cents: number;
  amount_raised_cents: number;
  donor_count: number;
  created_at: string;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
  }).format(cents / 100);

const statusColors: Record<string, string> = {
  draft: 'bg-default-200 text-default-600',
  active: 'bg-violet-500/20 text-violet-500',
  funded: 'bg-green-500/20 text-green-500',
  closed: 'bg-default-200 text-default-400',
};

export default function FounderCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/founder/campaign');
        const payload = await res.json() as { success: boolean; data?: Campaign[]; message?: string };
        if (!res.ok || !payload.success) throw new Error(payload.message || 'Failed to load');
        setCampaigns(payload.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Campaigns</h1>
        <Link
          href="/founder/campaign/new"
          className="px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
        >
          New Campaign
        </Link>
      </div>

      <nav aria-label="Founder Navigation" className="flex gap-4 text-sm">
        <Link href="/founder" className="text-violet-400 hover:text-violet-300 transition-colors">Dashboard</Link>
        <span className="text-default-300">|</span>
        <Link href="/founder/profile" className="text-violet-400 hover:text-violet-300 transition-colors">Profile</Link>
        <span className="text-default-300">|</span>
        <span className="text-foreground font-medium">Campaigns</span>
        <span className="text-default-300">|</span>
        <Link href="/founder/events" className="text-violet-400 hover:text-violet-300 transition-colors">Events</Link>
      </nav>

      {error && <p role="alert" className="text-danger">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-default-400">Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-default-400 mb-4">You haven&apos;t created any campaigns yet.</p>
          <Link
            href="/founder/campaign/new"
            className="text-violet-500 hover:text-violet-400 font-medium transition-colors"
          >
            Create your first campaign →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((campaign) => {
            const progress =
              campaign.funding_goal_cents > 0
                ? Math.min(Math.round((campaign.amount_raised_cents / campaign.funding_goal_cents) * 100), 100)
                : 0;

            return (
              <Link
                key={campaign.id}
                href={`/founder/campaign/${campaign.id}`}
                className="group block p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 hover:border-violet-500/50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-semibold text-lg group-hover:text-violet-400 transition-colors">
                    {campaign.title}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status] ?? ''}`}>
                    {campaign.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-default-400">
                    {formatCurrency(campaign.amount_raised_cents)} raised
                  </span>
                  <span className="font-medium text-violet-500">
                    {formatCurrency(campaign.funding_goal_cents)} goal
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-default-200 dark:bg-default-100/20 overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      campaign.status === 'funded'
                        ? 'bg-green-500'
                        : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="text-sm text-default-400">
                  {campaign.donor_count} donor{campaign.donor_count !== 1 ? 's' : ''} · {progress}% funded
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
