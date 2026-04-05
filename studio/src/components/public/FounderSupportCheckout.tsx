'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@heroui/button';

interface FounderSupportCheckoutProps {
  founderSlug: string;
  founderName: string;
  founderId?: string | null;
  /** Pre-selected sponsorship tier id — wired up for tier selection in #257. */
  tierId?: string | null;
  /** Pre-filled donation amount in cents from tier selection. */
  initialAmountCents?: number | null;
}

const PRESET_AMOUNTS = [500, 1000, 2500];
const MIN_CUSTOM_AMOUNT_CENTS = 100;
const MAX_CUSTOM_AMOUNT_CENTS = 100000;

function toCurrency(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountCents / 100);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

export function FounderSupportCheckout({
  founderSlug,
  founderName,
  founderId = null,
  tierId = null,
  initialAmountCents = null,
}: FounderSupportCheckoutProps): React.ReactElement {
  const [selectedAmount, setSelectedAmount] = useState<number>(
    initialAmountCents ?? PRESET_AMOUNTS[1]
  );
  const [customAmountInput, setCustomAmountInput] = useState<string>(
    initialAmountCents && !PRESET_AMOUNTS.includes(initialAmountCents)
      ? String(initialAmountCents / 100)
      : ''
  );
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customAmountCents = useMemo(() => {
    if (!customAmountInput) {
      return null;
    }

    const parsed = Number.parseFloat(customAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.round(parsed * 100);
  }, [customAmountInput]);

  const effectiveAmount = customAmountInput ? customAmountCents : selectedAmount;
  const isAmountValid = Boolean(
    effectiveAmount
      && effectiveAmount >= MIN_CUSTOM_AMOUNT_CENTS
      && effectiveAmount <= MAX_CUSTOM_AMOUNT_CENTS
  );

  async function startCheckout(): Promise<void> {
    setError(null);

    const email = normalizeEmail(donorEmail);
    if (!isLikelyEmail(email)) {
      setError('Enter a valid email to receive your donation confirmation.');
      return;
    }

    if (!effectiveAmount || !isAmountValid) {
      setError('Choose an amount between $1.00 and $1,000.00.');
      return;
    }

    setIsSubmitting(true);
    try {
      const origin = window.location.origin;
      const response = await fetch('/api/commerce/founder-support/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          founder_slug: founderSlug,
          founder_name: founderName,
          founder_id: founderId,
          donor_email: email,
          amount_cents: effectiveAmount,
          tier_id: tierId,
          success_url: `${origin}/public/directory/${encodeURIComponent(founderSlug)}?support=success`,
          cancel_url: `${origin}/public/directory/${encodeURIComponent(founderSlug)}?support=cancel`,
        }),
      });

      const payload = await response.json() as { checkoutUrl?: string; message?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.message ?? 'Could not start donation checkout.');
      }

      window.location.href = payload.checkoutUrl;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Could not start donation checkout.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-default-200 bg-default-50/70 p-4">
      <h2 className="text-xl font-semibold text-foreground">Support this Founder</h2>
      <p className="mt-1 text-sm text-default-500">
        Back {founderName} with a one-time contribution.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${
              !customAmountInput && selectedAmount === amount
                ? 'border-violet-500 bg-violet-500/10 text-violet-500'
                : 'border-default-200 text-default-600'
            }`}
            onClick={() => {
              setCustomAmountInput('');
              setSelectedAmount(amount);
            }}
          >
            {toCurrency(amount)}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-default-600" htmlFor="custom-donation-amount">
          Custom amount (USD)
          <input
            id="custom-donation-amount"
            type="number"
            min={1}
            step={0.01}
            value={customAmountInput}
            onChange={(event) => setCustomAmountInput(event.target.value)}
            placeholder="25.00"
            className="rounded-lg border border-default-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-default-600" htmlFor="donor-email">
          Email for receipt
          <input
            id="donor-email"
            type="email"
            value={donorEmail}
            onChange={(event) => setDonorEmail(event.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-default-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}

      <Button
        type="button"
        color="primary"
        className="mt-4 bg-violet-600 hover:bg-violet-700"
        isDisabled={!isAmountValid || isSubmitting}
        isLoading={isSubmitting}
        onPress={() => void startCheckout()}
      >
        {isSubmitting
          ? 'Redirecting...'
          : `Support this Founder${effectiveAmount ? ` (${toCurrency(effectiveAmount)})` : ''}`}
      </Button>
    </section>
  );
}
