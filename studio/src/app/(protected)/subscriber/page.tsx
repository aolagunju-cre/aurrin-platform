'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface Subscription {
  id: string;
  price_id: string | null;
  status: 'active' | 'past_due' | 'cancelled' | 'unpaid';
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

interface PriceDetails {
  id: string;
  amount_cents: number;
  currency: string;
}

interface ProductDetails {
  id: string;
  name: string;
}

interface PriceLookup {
  price: PriceDetails;
  product: ProductDetails | null;
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
}

export default function SubscriberPage(): React.ReactElement {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [detailsByPriceId, setDetailsByPriceId] = useState<Record<string, PriceLookup>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasSubscriptions = useMemo(() => subscriptions.length > 0, [subscriptions.length]);

  async function loadDashboard(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/subscriber/subscriptions', { headers: { authorization: '' } });
      const payload = await response.json() as { success: boolean; data?: Subscription[]; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to load subscriptions');
      }

      const rows = payload.data ?? [];
      setSubscriptions(rows);

      const uniquePriceIds = Array.from(new Set(rows.map((subscription) => subscription.price_id).filter(Boolean))) as string[];
      const lookups = await Promise.all(
        uniquePriceIds.map(async (priceId) => {
          const detailsResponse = await fetch(`/api/commerce/prices/${encodeURIComponent(priceId)}/details`);
          const detailsPayload = await detailsResponse.json() as {
            success: boolean;
            data?: PriceLookup;
          };
          return { priceId, details: detailsResponse.ok && detailsPayload.success ? detailsPayload.data ?? null : null };
        })
      );

      const nextDetails: Record<string, PriceLookup> = {};
      for (const lookup of lookups) {
        if (lookup.details) {
          nextDetails[lookup.priceId] = lookup.details;
        }
      }
      setDetailsByPriceId(nextDetails);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load subscriptions');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function manageSubscription(subscriptionId: string): Promise<void> {
    setBusyId(subscriptionId);
    setError(null);
    try {
      const response = await fetch(`/api/subscriber/subscriptions/${subscriptionId}/portal`, {
        method: 'POST',
        headers: { authorization: '' },
      });
      const payload = await response.json() as { success: boolean; data?: { url: string }; message?: string };
      if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(payload.message ?? 'Could not open customer portal');
      }
      window.location.href = payload.data.url;
    } catch (manageError) {
      setError(manageError instanceof Error ? manageError.message : 'Could not open customer portal');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelSubscription(subscriptionId: string): Promise<void> {
    const confirmed = window.confirm('Cancel this subscription?');
    if (!confirmed) {
      return;
    }

    setBusyId(subscriptionId);
    setError(null);
    try {
      const response = await fetch(`/api/subscriber/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: { authorization: '' },
      });
      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Could not cancel subscription');
      }
      await loadDashboard();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel subscription');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Subscriber Dashboard</h1>
      {error ? <p role="alert" style={{ color: '#b00', margin: 0 }}>{error}</p> : null}
      {isLoading ? <p>Loading subscriptions...</p> : null}

      {!isLoading && !hasSubscriptions ? <p>No active subscriptions found.</p> : null}

      {!isLoading && hasSubscriptions ? (
        <table aria-label="Subscriptions Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">Price</th>
              <th align="left">Next billing date</th>
              <th align="left">Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => {
              const details = subscription.price_id ? detailsByPriceId[subscription.price_id] : undefined;
              const isBusy = busyId === subscription.id;
              return (
                <tr key={subscription.id}>
                  <td>{details?.product?.name ?? 'Subscription'}</td>
                  <td>
                    {details
                      ? formatCurrency(details.price.amount_cents, details.price.currency)
                      : 'N/A'}
                  </td>
                  <td>{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}</td>
                  <td>{subscription.status}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" disabled={isBusy} onClick={() => void manageSubscription(subscription.id)}>
                      Manage
                    </button>
                    <button type="button" disabled={isBusy} onClick={() => void cancelSubscription(subscription.id)}>
                      Cancel Subscription
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
