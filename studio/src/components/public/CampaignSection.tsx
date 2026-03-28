'use client';

import React, { useEffect, useState } from 'react';

interface PledgeTier {
  name: string;
  amount_cents: number;
  description: string;
}

interface Donation {
  id: string;
  donor_name: string;
  amount_cents: number;
  created_at: string;
}

interface CampaignData {
  id: string;
  title: string;
  description: string | null;
  story: string | null;
  funding_goal_cents: number;
  amount_raised_cents: number;
  donor_count: number;
  status: string;
  pledge_tiers: PledgeTier[];
  donations: Donation[];
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
  }).format(cents / 100);

export function CampaignSection({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public/campaigns/${campaignId}`);
        const payload = await res.json() as { success: boolean; data?: CampaignData };
        if (res.ok && payload.success && payload.data) {
          setCampaign(payload.data);
        }
      } catch {
        // Campaign data is supplementary — fail silently
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [campaignId]);

  if (loading || !campaign) return null;

  const progress =
    campaign.funding_goal_cents > 0
      ? Math.min(Math.round((campaign.amount_raised_cents / campaign.funding_goal_cents) * 100), 100)
      : 0;
  const isFunded = campaign.status === 'funded' || progress >= 100;
  const isHalfway = progress >= 50;

  return (
    <div className="space-y-6">
      {/* Funding Progress */}
      <section className="rounded-2xl border border-default-200 bg-default-50/70 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{campaign.title}</h2>
          {isFunded && (
            <span className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold">
              Fully Funded
            </span>
          )}
        </div>

        {campaign.description && (
          <p className="text-default-500">{campaign.description}</p>
        )}

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-foreground font-semibold">
              {formatCurrency(campaign.amount_raised_cents)} raised
            </span>
            <span className="text-default-400">
              of {formatCurrency(campaign.funding_goal_cents)} goal
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-default-200 dark:bg-default-100/20 overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFunded ? 'bg-green-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
              }`}
              style={{ width: `${progress}%` }}
            />
            {/* 50% milestone marker */}
            <div className="absolute top-0 left-1/2 w-0.5 h-full bg-default-300/50" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-default-400">
              {campaign.donor_count} donor{campaign.donor_count !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              {isHalfway && !isFunded && (
                <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-medium">
                  50% reached
                </span>
              )}
              {isFunded && (
                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                  100% funded
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      {campaign.story && (
        <section className="rounded-2xl border border-default-200 bg-default-50/70 p-6">
          <h2 className="text-xl font-semibold text-foreground mb-3">Our Story</h2>
          <div className="text-default-500 whitespace-pre-wrap leading-relaxed">
            {campaign.story}
          </div>
        </section>
      )}

      {/* Pledge Tiers */}
      {campaign.pledge_tiers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Back This Founder</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaign.pledge_tiers.map((tier, index) => (
              <div
                key={index}
                className="p-5 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 hover:border-violet-500/50 transition-all"
              >
                <p className="text-2xl font-bold text-violet-500 mb-1">
                  {formatCurrency(tier.amount_cents)}
                </p>
                <p className="font-semibold text-foreground mb-2">{tier.name}</p>
                <p className="text-sm text-default-500">{tier.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Donors */}
      {campaign.donations.length > 0 && (
        <section className="rounded-2xl border border-default-200 bg-default-50/70 p-6">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Supporters ({campaign.donor_count})
          </h2>
          <div className="space-y-3">
            {campaign.donations.slice(0, 10).map((donation) => (
              <div key={donation.id} className="flex items-center justify-between py-2 border-b border-default-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-semibold">
                    {donation.donor_name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="text-sm text-foreground">{donation.donor_name}</span>
                </div>
                <span className="text-sm font-medium text-violet-500">
                  {formatCurrency(donation.amount_cents)}
                </span>
              </div>
            ))}
            {campaign.donations.length > 10 && (
              <p className="text-sm text-default-400 text-center pt-2">
                and {campaign.donations.length - 10} more supporters
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
