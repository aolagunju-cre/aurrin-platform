import { getSupabaseClient } from '../db/client';

function isFutureIsoTimestamp(value: string | null): boolean {
  if (!value) {
    return true;
  }
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && timestamp > Date.now();
}

function hasActiveSubscription(status: string, currentPeriodEnd: string | null): boolean {
  if (status !== 'active') {
    return false;
  }
  return isFutureIsoTimestamp(currentPeriodEnd);
}

export async function hasEntitlement(userId: string, productId: string): Promise<boolean> {
  const client = getSupabaseClient();

  const [subscriptionsResult, entitlementsResult] = await Promise.all([
    client.db.listSubscriptionsByUserId(userId),
    client.db.listEntitlementsByUserId(userId),
  ]);

  if (subscriptionsResult.error) {
    throw subscriptionsResult.error;
  }
  if (entitlementsResult.error) {
    throw entitlementsResult.error;
  }

  const activeSubscription = subscriptionsResult.data.some((subscription) =>
    hasActiveSubscription(subscription.status, subscription.current_period_end)
  );

  if (activeSubscription) {
    return true;
  }

  return entitlementsResult.data.some((entitlement) => {
    if (entitlement.product_id !== productId) {
      return false;
    }
    if (!isFutureIsoTimestamp(entitlement.expires_at)) {
      return false;
    }
    return entitlement.source === 'purchase' || entitlement.source === 'subscription';
  });
}
