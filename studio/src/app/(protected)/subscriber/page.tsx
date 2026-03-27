'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';

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
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Subscriber Dashboard</h1>
      {error ? <p role="alert" className="text-danger">{error}</p> : null}
      {isLoading ? <p className="text-default-400">Loading subscriptions...</p> : null}

      {!isLoading && !hasSubscriptions ? <p className="py-12 text-center text-default-400">No active subscriptions found.</p> : null}

      {!isLoading && hasSubscriptions ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Subscriptions Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Product</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Price</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Next billing date</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Status</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => {
                const details = subscription.price_id ? detailsByPriceId[subscription.price_id] : undefined;
                const isBusy = busyId === subscription.id;
                return (
                  <tr key={subscription.id} className="hover:bg-default-100/50 transition-colors">
                    <td className="px-4 py-3 border-b border-default-100 text-foreground">{details?.product?.name ?? 'Subscription'}</td>
                    <td className="px-4 py-3 border-b border-default-100 text-default-500">
                      {details
                        ? formatCurrency(details.price.amount_cents, details.price.currency)
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 border-b border-default-100 text-default-500">{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-4 py-3 border-b border-default-100">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        subscription.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        subscription.status === 'past_due' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>{subscription.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-default-100">
                      <div className="flex gap-2">
                        <Button size="sm" color="secondary" isDisabled={isBusy} onPress={() => void manageSubscription(subscription.id)}>
                          Manage
                        </Button>
                        <Button size="sm" color="danger" variant="flat" isDisabled={isBusy} onPress={() => void cancelSubscription(subscription.id)}>
                          Cancel Subscription
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
