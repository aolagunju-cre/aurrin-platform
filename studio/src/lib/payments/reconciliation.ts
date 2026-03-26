import Stripe from 'stripe';
import { enqueueJob } from '../jobs/enqueue';
import { logger } from '../logging/logger';
import {
  getSupabaseClient,
  type CommerceSubscriptionStatus,
  type SubscriptionRecord,
} from '../db/client';
import { getStripeClient } from './stripe-client';

export const SUBSCRIPTION_CREATED_MESSAGE = 'Welcome! Your subscription is active';
export const SUBSCRIPTION_UPDATED_MESSAGE = 'Your billing information has been updated';
export const PAYMENT_FAILED_MESSAGE = 'Payment failed; update payment method to avoid interruption';

export interface ReconciliationResult {
  checked: number;
  corrected: number;
  notificationsQueued: number;
}

function mapStripeStatus(status: Stripe.Subscription.Status): CommerceSubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'cancelled';
    case 'unpaid':
      return 'unpaid';
    default:
      return 'unpaid';
  }
}

function readSubscriptionUnixField(subscription: Stripe.Subscription, key: string): string | null {
  const value = (subscription as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null;
}

function normalizeIso(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function buildCancellationMessage(currentPeriodEnd: string | null): string {
  const accessUntil = currentPeriodEnd ? currentPeriodEnd.slice(0, 10) : 'your current billing period end date';
  return `Your subscription was cancelled; you have access until ${accessUntil}`;
}

function buildUnexpectedStatusMessage(status: CommerceSubscriptionStatus, currentPeriodEnd: string | null): string {
  if (status === 'cancelled') {
    return buildCancellationMessage(currentPeriodEnd);
  }
  if (status === 'past_due' || status === 'unpaid') {
    return PAYMENT_FAILED_MESSAGE;
  }
  if (status === 'active') {
    return SUBSCRIPTION_CREATED_MESSAGE;
  }
  return SUBSCRIPTION_UPDATED_MESSAGE;
}

function hasSubscriptionDrift(local: SubscriptionRecord, stripeSubscription: Stripe.Subscription): boolean {
  const expectedStatus = mapStripeStatus(stripeSubscription.status);
  const expectedPeriodEnd = normalizeIso(readSubscriptionUnixField(stripeSubscription, 'current_period_end'));
  const expectedCancelAt = normalizeIso(readSubscriptionUnixField(stripeSubscription, 'cancel_at'));

  if (local.status !== expectedStatus) {
    return true;
  }
  if (normalizeIso(local.current_period_end) !== expectedPeriodEnd) {
    return true;
  }
  if (normalizeIso(local.cancel_at) !== expectedCancelAt) {
    return true;
  }

  return false;
}

async function queueNotificationForUser(userId: string, message: string): Promise<boolean> {
  const db = getSupabaseClient().db;
  const userResult = await db.getUserById(userId);
  if (userResult.error) {
    throw userResult.error;
  }
  const email = userResult.data?.email;
  if (!email) {
    logger.warn('Skipping reconciliation notification because user email is missing', {
      action: 'subscription_reconciliation_notification_skipped',
      user_id: userId,
    });
    return false;
  }

  await enqueueJob(
    'send_email',
    {
      to: email,
      template_name: 'subscription_notification',
      data: { message },
    },
    {
      aggregate_id: userId,
      aggregate_type: 'user',
    }
  );

  return true;
}

export async function reconcileStripeSubscriptions(
  stripeClient: Stripe = getStripeClient()
): Promise<ReconciliationResult> {
  const db = getSupabaseClient().db;
  const stats: ReconciliationResult = {
    checked: 0,
    corrected: 0,
    notificationsQueued: 0,
  };

  const response = await stripeClient.subscriptions.list({
    status: 'all',
    limit: 100,
  });

  for (const stripeSubscription of response.data) {
    stats.checked++;

    const local = await db.getSubscriptionByStripeId(stripeSubscription.id);
    if (local.error) {
      throw local.error;
    }
    if (!local.data) {
      continue;
    }

    if (!hasSubscriptionDrift(local.data, stripeSubscription)) {
      continue;
    }

    const nextStatus = mapStripeStatus(stripeSubscription.status);
    const upsertResult = await db.upsertSubscription({
      id: local.data.id,
      user_id: local.data.user_id,
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id:
        typeof stripeSubscription.customer === 'string'
          ? stripeSubscription.customer
          : local.data.stripe_customer_id,
      price_id: local.data.price_id,
      status: nextStatus,
      current_period_start: readSubscriptionUnixField(stripeSubscription, 'current_period_start'),
      current_period_end: readSubscriptionUnixField(stripeSubscription, 'current_period_end'),
      cancel_at: readSubscriptionUnixField(stripeSubscription, 'cancel_at'),
    });
    if (upsertResult.error) {
      throw upsertResult.error;
    }

    stats.corrected++;

    const message = buildUnexpectedStatusMessage(nextStatus, upsertResult.data?.current_period_end ?? null);
    const queued = await queueNotificationForUser(local.data.user_id, message);
    if (queued) {
      stats.notificationsQueued++;
    }
  }

  return stats;
}

export function formatCancellationMessage(currentPeriodEnd: string | null): string {
  return buildCancellationMessage(currentPeriodEnd);
}
