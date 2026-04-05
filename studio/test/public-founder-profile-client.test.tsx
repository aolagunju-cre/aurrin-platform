/** @jest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FounderProfileClient } from '../src/components/public/FounderProfileClient';
import type { SponsorshipTierRecord } from '../src/lib/db/client';

jest.mock('../src/components/public/FounderSupportCheckout', () => ({
  FounderSupportCheckout: ({ tierId, initialAmountCents }: { tierId: string | null; initialAmountCents: number | null }) => (
    <div data-testid="checkout" data-tier-id={tierId ?? ''} data-initial-amount={initialAmountCents ?? ''} />
  ),
}));

const SAMPLE_TIERS: SponsorshipTierRecord[] = [
  {
    id: 'tier-1',
    founder_id: 'user-1',
    label: 'Bronze Supporter',
    amount_cents: 2500,
    perk_description: 'Thank-you email + name on website',
    sort_order: 0,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tier-2',
    founder_id: 'user-1',
    label: 'Silver Backer',
    amount_cents: 10000,
    perk_description: '30-min strategy call',
    sort_order: 1,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

describe('FounderProfileClient', () => {
  it('renders funding goal progress bar when goal is set', () => {
    render(
      <FounderProfileClient
        founderSlug="acme-corp"
        founderName="Jane Doe"
        founderId="founder-1"
        tiers={[]}
        fundingGoalCents={500000}
        totalDonatedCents={125000}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText(/\$1,250 raised of \$5,000 goal/i)).toBeInTheDocument();
    expect(screen.getByText(/25% funded/i)).toBeInTheDocument();
  });

  it('does not render funding progress bar when goal is null', () => {
    render(
      <FounderProfileClient
        founderSlug="acme-corp"
        founderName="Jane Doe"
        founderId="founder-1"
        tiers={[]}
        fundingGoalCents={null}
        totalDonatedCents={0}
      />
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders sponsorship tiers with label, amount, and perk', () => {
    render(
      <FounderProfileClient
        founderSlug="acme-corp"
        founderName="Jane Doe"
        founderId="founder-1"
        tiers={SAMPLE_TIERS}
        fundingGoalCents={null}
        totalDonatedCents={0}
      />
    );

    expect(screen.getByText('Bronze Supporter')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('Thank-you email + name on website')).toBeInTheDocument();
    expect(screen.getByText('Silver Backer')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('shows empty state message when no tiers exist', () => {
    render(
      <FounderProfileClient
        founderSlug="acme-corp"
        founderName="Jane Doe"
        founderId="founder-1"
        tiers={[]}
        fundingGoalCents={null}
        totalDonatedCents={0}
      />
    );

    expect(screen.getByText(/no sponsorship tiers have been configured/i)).toBeInTheDocument();
  });

  it('selects a tier and passes tierId and initialAmountCents to checkout', () => {
    render(
      <FounderProfileClient
        founderSlug="acme-corp"
        founderName="Jane Doe"
        founderId="founder-1"
        tiers={SAMPLE_TIERS}
        fundingGoalCents={null}
        totalDonatedCents={0}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /bronze supporter/i }));

    const checkout = screen.getByTestId('checkout');
    expect(checkout).toHaveAttribute('data-tier-id', 'tier-1');
    expect(checkout).toHaveAttribute('data-initial-amount', '2500');
  });

  it('marks selected tier as pressed (aria-pressed)', () => {
    render(
      <FounderProfileClient
        founderSlug="acme-corp"
        founderName="Jane Doe"
        founderId="founder-1"
        tiers={SAMPLE_TIERS}
        fundingGoalCents={null}
        totalDonatedCents={0}
      />
    );

    const bronzeButton = screen.getByRole('button', { name: /bronze supporter/i });
    expect(bronzeButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(bronzeButton);
    expect(bronzeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders checkout component even with no tiers', () => {
    render(
      <FounderProfileClient
        founderSlug="acme-corp"
        founderName="Jane Doe"
        founderId="founder-1"
        tiers={[]}
        fundingGoalCents={null}
        totalDonatedCents={0}
      />
    );

    expect(screen.getByTestId('checkout')).toBeInTheDocument();
  });
});
