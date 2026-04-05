'use client';

import React, { useState } from 'react';
import type { SponsorshipTierRecord } from '../../lib/db/client';
import { FounderSupportCheckout } from './FounderSupportCheckout';

interface FounderProfileClientProps {
  founderSlug: string;
  founderName: string;
  founderId: string;
  tiers: SponsorshipTierRecord[];
  fundingGoalCents: number | null;
  totalDonatedCents: number;
}

function toCurrency(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

export function FounderProfileClient({
  founderSlug,
  founderName,
  founderId,
  tiers,
  fundingGoalCents,
  totalDonatedCents,
}: FounderProfileClientProps): React.ReactElement {
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(null);

  function handleTierSelect(tier: SponsorshipTierRecord): void {
    setSelectedTierId(tier.id);
    setSelectedAmountCents(tier.amount_cents);
  }

  const progressPercent =
    fundingGoalCents && fundingGoalCents > 0
      ? Math.min(100, Math.round((totalDonatedCents / fundingGoalCents) * 100))
      : null;

  return (
    <div className="space-y-6">
      {fundingGoalCents && fundingGoalCents > 0 ? (
        <section aria-label="Funding progress" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
          <h2 className="text-xl font-semibold text-foreground mb-3">Funding Goal</h2>
          <p className="text-sm text-default-500 mb-2">
            {toCurrency(totalDonatedCents)} raised of {toCurrency(fundingGoalCents)} goal
          </p>
          <div
            role="progressbar"
            aria-valuenow={progressPercent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent ?? 0}% of funding goal reached`}
            className="w-full h-3 rounded-full bg-default-200 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${progressPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-default-400">{progressPercent ?? 0}% funded</p>
        </section>
      ) : null}

      {tiers.length > 0 ? (
        <section aria-label="Sponsorship tiers" className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Sponsorship Tiers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {tiers.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleTierSelect(tier)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  selectedTierId === tier.id
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-default-200 bg-default-50 dark:bg-default-50/5 hover:border-violet-400'
                }`}
                aria-pressed={selectedTierId === tier.id}
              >
                <p className="font-semibold text-foreground">{tier.label}</p>
                <p className="text-sm text-violet-500 font-medium">{toCurrency(tier.amount_cents)}</p>
                <p className="mt-1 text-sm text-default-500">{tier.perk_description}</p>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-default-400 text-sm">No sponsorship tiers have been configured yet.</p>
      )}

      <FounderSupportCheckout
        founderSlug={founderSlug}
        founderName={founderName}
        founderId={founderId}
        tierId={selectedTierId}
        initialAmountCents={selectedAmountCents}
      />
    </div>
  );
}
