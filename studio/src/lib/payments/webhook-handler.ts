import type Stripe from 'stripe';
import { auditLog } from '../audit/log';
import { getSupabaseClient, type CommerceSubscriptionStatus, type CommerceTransactionStatus, type SubscriptionRecord } from '../db/client';
import { enqueueJob } from '../jobs/enqueue';
import { logger } from '../logging/logger';
import {
  formatCancellationMessage,
  PAYMENT_FAILED_MESSAGE,
  SUBSCRIPTION_CREATED_MESSAGE,
  SUBSCRIPTION_UPDATED_MESSAGE,
} from './reconciliation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WebhookProcessResult {
  duplicate: boolean;
  deadLettered: boolean;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): CommerceSubscriptionStatus {
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

function currencyToUpper(value: string | null | undefined): string | null {
  return value ? value.toUpperCase() : null;
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isLikelyEmail(value: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value));
}

function readPositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function readFutureIsoTimestamp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp) || timestamp <= Date.now()) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function resolvePurchaseEntitlementExpiry(
  accessType: 'perpetual' | 'time-limited' | null,
  metadata: Record<string, string>
): string | null {
  if (accessType !== 'time-limited') {
    return null;
  }

  const configuredExpiry = readFutureIsoTimestamp(metadata.entitlement_expires_at);
  if (configuredExpiry) {
    return configuredExpiry;
  }

  const durationDays = readPositiveInteger(metadata.entitlement_duration_days);
  if (durationDays) {
    const expiry = new Date();
    expiry.setUTCDate(expiry.getUTCDate() + durationDays);
    return expiry.toISOString();
  }

  throw new Error('Missing time-limited entitlement configuration for digital product purchase');
}

function readUnixTimestampField(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (typeof value !== 'number') {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function pickUserId(candidate: unknown, fallback: string | null | undefined): string {
  if (isUuid(candidate)) {
    return candidate;
  }
  if (isUuid(fallback)) {
    return fallback;
  }
  throw new Error('Missing subscription user_id metadata for Stripe event processing');
}

async function tryAudit(
  action: string,
  actorId: string,
  resourceType: string,
  resourceId: string | null,
  changes: Record<string, unknown>
): Promise<void> {
  if (!isUuid(actorId)) {
    return;
  }

  await auditLog(action, actorId, {
    resource_type: resourceType,
    resource_id: resourceId,
    changes,
  });
}

async function enqueueSubscriptionNotification(userId: string, message: string): Promise<void> {
  const db = getSupabaseClient().db;
  const userResult = await db.getUserById(userId);
  if (userResult.error) {
    throw userResult.error;
  }
  const email = userResult.data?.email;
  if (!email) {
    return;
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
}

async function processSubscriptionEvent(event: Stripe.Event, existingSubscription: SubscriptionRecord | null): Promise<void> {
  const db = getSupabaseClient().db;
  const subscription = event.data.object as Stripe.Subscription;
  const userId = pickUserId(subscription.metadata?.user_id, existingSubscription?.user_id ?? null);
  const mappedStatus = mapSubscriptionStatus(subscription.status);

  const firstItem = subscription.items.data[0];
  const priceMetadata = firstItem?.price?.metadata ?? {};
  const subscriptionRecord = subscription as unknown as Record<string, unknown>;
  const priceId = isUuid(subscription.metadata?.price_id)
    ? subscription.metadata.price_id
    : isUuid(priceMetadata.price_id)
      ? priceMetadata.price_id
      : (existingSubscription?.price_id ?? null);

  const upsert = await db.upsertSubscription({
    id: existingSubscription?.id,
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
    price_id: priceId,
    status: mappedStatus,
    current_period_start: readUnixTimestampField(subscriptionRecord, 'current_period_start'),
    current_period_end: readUnixTimestampField(subscriptionRecord, 'current_period_end'),
    cancel_at: readUnixTimestampField(subscriptionRecord, 'cancel_at'),
  });

  if (upsert.error) {
    throw upsert.error;
  }

  const insertedTx = await db.insertTransaction({
    user_id: userId,
    subscription_id: upsert.data?.id ?? existingSubscription?.id ?? null,
    stripe_event_id: event.id,
    event_type: event.type,
    amount_cents: null,
    currency: null,
    status: 'succeeded',
  });

  if (insertedTx.error) {
    throw insertedTx.error;
  }

  const productId = isUuid(subscription.metadata?.product_id)
    ? subscription.metadata.product_id
    : isUuid(priceMetadata.product_id)
      ? priceMetadata.product_id
      : null;

  if (mapSubscriptionStatus(subscription.status) === 'active' && productId) {
    const entitlement = await db.insertEntitlement({
      user_id: userId,
      product_id: productId,
      source: 'subscription',
    });
    if (entitlement.error) {
      throw entitlement.error;
    }
  }

  await tryAudit(
    'subscription_synced',
    userId,
    'subscription',
    upsert.data?.id ?? existingSubscription?.id ?? null,
    {
      stripe_subscription_id: subscription.id,
      status: mappedStatus,
      event_type: event.type,
    }
  );

  if (event.type === 'customer.subscription.created') {
    await enqueueSubscriptionNotification(userId, SUBSCRIPTION_CREATED_MESSAGE);
    return;
  }

  if (event.type === 'customer.subscription.updated') {
    if (mappedStatus === 'cancelled') {
      await enqueueSubscriptionNotification(
        userId,
        formatCancellationMessage(upsert.data?.current_period_end ?? readUnixTimestampField(subscriptionRecord, 'current_period_end'))
      );
      return;
    }
    await enqueueSubscriptionNotification(userId, SUBSCRIPTION_UPDATED_MESSAGE);
  }
}

async function processRefundEvent(event: Stripe.Event): Promise<void> {
  const db = getSupabaseClient().db;
  const charge = event.data.object as Stripe.Charge;

  const insertedTx = await db.insertTransaction({
    user_id: isUuid(charge.metadata?.user_id) ? charge.metadata.user_id : null,
    subscription_id: isUuid(charge.metadata?.subscription_id) ? charge.metadata.subscription_id : null,
    stripe_event_id: event.id,
    event_type: event.type,
    amount_cents: charge.amount_refunded || charge.amount,
    currency: currencyToUpper(charge.currency),
    status: 'refunded' as CommerceTransactionStatus,
  });

  if (insertedTx.error) {
    throw insertedTx.error;
  }

  if (isUuid(charge.metadata?.user_id)) {
    await tryAudit('payment_refunded', charge.metadata.user_id, 'transaction', insertedTx.data?.id ?? null, {
      stripe_charge_id: charge.id,
      amount_cents: charge.amount_refunded || charge.amount,
    });
  }
}

async function processPaymentIntentSucceededEvent(event: Stripe.Event): Promise<void> {
  const db = getSupabaseClient().db;
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const metadata = paymentIntent.metadata ?? {};
  const userId = isUuid(metadata.user_id) ? metadata.user_id : null;
  const productId = isUuid(metadata.product_id) ? metadata.product_id : null;

  const insertedTx = await db.insertTransaction({
    user_id: userId,
    subscription_id: isUuid(metadata.subscription_id)
      ? metadata.subscription_id
      : null,
    stripe_event_id: event.id,
    event_type: event.type,
    amount_cents: paymentIntent.amount_received || paymentIntent.amount,
    currency: currencyToUpper(paymentIntent.currency),
    status: 'succeeded' as CommerceTransactionStatus,
    metadata: metadata as Record<string, unknown>,
  });

  if (insertedTx.error) {
    throw insertedTx.error;
  }

  if (userId) {
    await tryAudit('payment_succeeded', userId, 'transaction', insertedTx.data?.id ?? null, {
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount_received || paymentIntent.amount,
    });
  }

  if (userId && productId) {
    const productResult = await db.getProductById(productId);
    if (productResult.error) {
      throw productResult.error;
    }

    const product = productResult.data;
    if (!product || product.product_type !== 'digital') {
      return;
    }

    const entitlement = await db.insertEntitlement({
      user_id: userId,
      product_id: productId,
      source: 'purchase',
      expires_at: resolvePurchaseEntitlementExpiry(product.access_type, metadata),
    });
    if (entitlement.error) {
      throw entitlement.error;
    }

    if (product.file_id) {
      await enqueueJob(
        'send_email',
        {
          template_name: 'digital_product_download',
          data: {
            product_id: productId,
            file_id: product.file_id,
          },
        },
        {
          aggregate_id: productId,
          aggregate_type: 'product',
        }
      );
    }

    await tryAudit('entitlement_granted', userId, 'entitlement', entitlement.data?.id ?? null, {
      product_id: productId,
      source: 'purchase',
      event_type: event.type,
    });
  }

  if (metadata.kind === 'founder_support') {
    const founderSlug = readTrimmedString(metadata.founder_slug);
    const founderName = readTrimmedString(metadata.founder_name);
    const donorEmail = readTrimmedString(metadata.donor_email) ?? readTrimmedString(paymentIntent.receipt_email);
    const amount = paymentIntent.amount_received || paymentIntent.amount;
    const founderId = readTrimmedString(metadata.founder_id);
    const tierId = readTrimmedString(metadata.tier_id);
    const donorUserId = readTrimmedString(metadata.donor_user_id);

    // Insert donation row (idempotent — check first)
    if (isUuid(founderId)) {
      const existing = await db.getDonationByStripePaymentIntentId(paymentIntent.id);
      if (existing.error) {
        throw existing.error;
      }
      if (!existing.data) {
        const donationInsert = await db.insertDonation({
          founder_id: founderId,
          donor_email: isLikelyEmail(donorEmail) ? donorEmail : null,
          donor_user_id: isUuid(donorUserId) ? donorUserId : null,
          tier_id: isUuid(tierId) ? tierId : null,
          amount_cents: amount,
          stripe_payment_intent_id: paymentIntent.id,
          status: 'completed',
        });
        if (donationInsert.error) {
          throw donationInsert.error;
        }
      }
    }

    if (isLikelyEmail(donorEmail)) {
      await enqueueJob(
        'send_email',
        {
          to: donorEmail,
          template_name: 'founder_support_confirmation',
          data: {
            founder_slug: founderSlug,
            founder_name: founderName,
            amount_cents: amount,
            amount: amount / 100,
            currency: currencyToUpper(paymentIntent.currency) ?? 'USD',
          },
        },
        {
          aggregate_id: founderSlug ?? paymentIntent.id,
          aggregate_type: 'founder_support',
        }
      );
    }
  }
}

async function processInvoicePaymentFailedEvent(event: Stripe.Event): Promise<void> {
  const db = getSupabaseClient().db;
  const invoice = event.data.object as Stripe.Invoice;
  const invoiceRecord = invoice as unknown as Record<string, unknown>;

  const stripeSubscriptionId =
    typeof invoiceRecord.subscription === 'string' ? invoiceRecord.subscription : null;
  let existingSubscription: SubscriptionRecord | null = null;
  if (stripeSubscriptionId) {
    const existing = await db.getSubscriptionByStripeId(stripeSubscriptionId);
    if (existing.error) {
      throw existing.error;
    }
    existingSubscription = existing.data;
  }

  if (existingSubscription?.stripe_subscription_id) {
    const upsertResult = await db.upsertSubscription({
      id: existingSubscription.id,
      user_id: existingSubscription.user_id,
      stripe_subscription_id: existingSubscription.stripe_subscription_id,
      stripe_customer_id:
        typeof invoiceRecord.customer === 'string' ? invoiceRecord.customer : existingSubscription.stripe_customer_id,
      price_id: existingSubscription.price_id,
      status: 'past_due',
      current_period_start: existingSubscription.current_period_start,
      current_period_end: existingSubscription.current_period_end,
      cancel_at: existingSubscription.cancel_at,
    });
    if (upsertResult.error) {
      throw upsertResult.error;
    }
  }

  const invoiceMetadata =
    (typeof invoiceRecord.metadata === 'object' && invoiceRecord.metadata !== null
      ? invoiceRecord.metadata
      : {}) as Record<string, unknown>;
  const userId = existingSubscription?.user_id ?? (isUuid(invoiceMetadata.user_id) ? invoiceMetadata.user_id : null);
  const amountDue = typeof invoiceRecord.amount_due === 'number' ? invoiceRecord.amount_due : null;
  const insertedTx = await db.insertTransaction({
    user_id: userId,
    subscription_id: existingSubscription?.id ?? null,
    stripe_event_id: event.id,
    event_type: event.type,
    amount_cents: amountDue,
    currency: currencyToUpper(typeof invoiceRecord.currency === 'string' ? invoiceRecord.currency : null),
    status: 'failed' as CommerceTransactionStatus,
  });

  if (insertedTx.error) {
    throw insertedTx.error;
  }

  if (userId) {
    await enqueueSubscriptionNotification(userId, PAYMENT_FAILED_MESSAGE);
  }
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
  const db = getSupabaseClient().db;

  const existingTransaction = await db.getTransactionByStripeEventId(event.id);
  if (existingTransaction.error) {
    throw existingTransaction.error;
  }

  if (existingTransaction.data) {
    return { duplicate: true, deadLettered: false };
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const existingSubscription = await db.getSubscriptionByStripeId(subscription.id);
        if (existingSubscription.error) {
          throw existingSubscription.error;
        }
        await processSubscriptionEvent(event, existingSubscription.data);
        break;
      }
      case 'charge.refunded':
        await processRefundEvent(event);
        break;
      case 'payment_intent.succeeded':
        await processPaymentIntentSucceededEvent(event);
        break;
      case 'invoice.payment_failed':
        await processInvoicePaymentFailedEvent(event);
        break;
      default:
        logger.info('Ignoring unsupported Stripe webhook event', {
          action: 'stripe_webhook_ignored',
          event_type: event.type,
          stripe_event_id: event.id,
        });
    }

    return { duplicate: false, deadLettered: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Stripe webhook processing failed; enqueueing dead-letter job', {
      action: 'stripe_webhook_failed',
      stripe_event_id: event.id,
      event_type: event.type,
      error: message,
    });

    try {
      await enqueueJob(
        'webhook',
        {
          kind: 'stripe_webhook_dead_letter',
          stripe_event_id: event.id,
          event_type: event.type,
          error: message,
        },
        {
          aggregate_id: event.id,
          aggregate_type: 'stripe_event',
        }
      );
    } catch (enqueueError) {
      logger.error('Failed to enqueue Stripe webhook dead-letter job', {
        action: 'stripe_webhook_dead_letter_enqueue_failed',
        stripe_event_id: event.id,
        error: enqueueError instanceof Error ? enqueueError.message : String(enqueueError),
      });
    }

    return { duplicate: false, deadLettered: true };
  }
}
