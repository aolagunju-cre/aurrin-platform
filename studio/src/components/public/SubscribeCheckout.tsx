'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PremiumContentNotice } from '../content/PremiumContentNotice';
import { Button } from '@heroui/button';
import { Spinner } from '@heroui/spinner';

interface Product {
  id: string;
  name: string;
  description: string | null;
}

interface Price {
  id: string;
  amount_cents: number;
  currency: string;
  billing_interval: 'monthly' | 'yearly';
}

interface DetailsPayload {
  price: Price;
  product: Product | null;
}

export function SubscribeCheckout({ priceId }: { priceId: string }): React.ReactElement {
  const [details, setDetails] = useState<DetailsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadDetails(): Promise<void> {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/commerce/prices/${encodeURIComponent(priceId)}/details`);
        const payload = await response.json() as { success: boolean; data?: DetailsPayload; message?: string };
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message ?? 'Could not load subscription details');
        }
        setDetails(payload.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load subscription details');
      } finally {
        setIsLoading(false);
      }
    }

    void loadDetails();
  }, [priceId]);

  const formattedPrice = useMemo(() => {
    if (!details) {
      return '';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: details.price.currency,
    }).format(details.price.amount_cents / 100);
  }, [details]);

  async function startCheckout(): Promise<void> {
    if (!details) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const response = await fetch('/api/commerce/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: details.price.id,
          success_url: `${origin}/public/subscribe/${details.price.id}?status=success`,
          cancel_url: `${origin}/public/subscribe/${details.price.id}?status=cancel`,
        }),
      });
      const payload = await response.json() as { sessionId?: string; checkoutUrl?: string; message?: string; success?: boolean };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.message ?? 'Could not start checkout');
      }
      window.location.href = payload.checkoutUrl;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Could not start checkout');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8 grid gap-6">
      <h1 className="text-2xl font-bold text-foreground">Subscribe</h1>
      <PremiumContentNotice />

      {error ? <p role="alert" className="text-danger text-sm">{error}</p> : null}
      {isLoading ? (
        <div className="flex items-center gap-3 py-8">
          <Spinner color="secondary" size="sm" />
          <p className="text-default-500">Loading subscription details...</p>
        </div>
      ) : null}

      {details ? (
        <section className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 grid gap-4 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10">
          <div className="grid gap-2">
            <p className="text-foreground">
              <span className="font-semibold text-default-500">Product:</span>{' '}
              {details.product?.name ?? 'Subscription'}
            </p>
            <p className="text-foreground">
              <span className="font-semibold text-default-500">Price:</span>{' '}
              <span className="text-violet-400 font-semibold">{formattedPrice}</span>
            </p>
            <p className="text-foreground">
              <span className="font-semibold text-default-500">Billing period:</span>{' '}
              <span className="inline-block px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium capitalize">
                {details.price.billing_interval}
              </span>
            </p>
          </div>
          <div className="border-t border-default-200 dark:border-gray-700 pt-4">
            <p className="font-semibold text-default-500 mb-1">Features</p>
            <p className="text-default-600">{details.product?.description ?? 'Premium subscriber access'}</p>
          </div>
          <Button
            type="button"
            color="primary"
            isDisabled={isSubmitting}
            isLoading={isSubmitting}
            onPress={() => void startCheckout()}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isSubmitting ? 'Starting checkout...' : 'Subscribe'}
          </Button>
        </section>
      ) : null}
    </main>
  );
}
