'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PremiumContentNotice } from '../content/PremiumContentNotice';

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
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem', display: 'grid', gap: '1rem' }}>
      <h1 style={{ marginBottom: 0 }}>Subscribe</h1>
      <PremiumContentNotice />

      {error ? <p role="alert" style={{ color: '#b00', margin: 0 }}>{error}</p> : null}
      {isLoading ? <p>Loading subscription details...</p> : null}

      {details ? (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
          <p style={{ margin: 0 }}><strong>Product</strong>: {details.product?.name ?? 'Subscription'}</p>
          <p style={{ margin: 0 }}><strong>Price</strong>: {formattedPrice}</p>
          <p style={{ margin: 0 }}><strong>Billing period</strong>: {details.price.billing_interval}</p>
          <div>
            <p style={{ margin: 0 }}><strong>Features</strong></p>
            <p style={{ margin: 0 }}>{details.product?.description ?? 'Premium subscriber access'}</p>
          </div>
          <button type="button" onClick={() => void startCheckout()} disabled={isSubmitting}>
            {isSubmitting ? 'Starting checkout...' : 'Subscribe'}
          </button>
        </section>
      ) : null}
    </main>
  );
}
