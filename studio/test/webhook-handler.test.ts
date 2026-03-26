/** @jest-environment node */

import type Stripe from 'stripe';
import { getSupabaseClient } from '../src/lib/db/client';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { auditLog } from '../src/lib/audit/log';
import { handleStripeWebhookEvent } from '../src/lib/payments/webhook-handler';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
const mockedAuditLog = auditLog as jest.MockedFunction<typeof auditLog>;

const userId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const priceId = '33333333-3333-4333-8333-333333333333';
const subscriptionId = '44444444-4444-4444-8444-444444444444';

describe('handleStripeWebhookEvent', () => {
  const db = {
    getTransactionByStripeEventId: jest.fn(),
    getSubscriptionByStripeId: jest.fn(),
    getUserById: jest.fn(),
    upsertSubscription: jest.fn(),
    insertTransaction: jest.fn(),
    insertEntitlement: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: db as never,
    });

    db.getTransactionByStripeEventId.mockResolvedValue({ data: null, error: null });
    db.getSubscriptionByStripeId.mockResolvedValue({ data: null, error: null });
    db.getUserById.mockResolvedValue({
      data: {
        id: userId,
        email: 'subscriber@example.com',
      },
      error: null,
    });
    db.upsertSubscription.mockResolvedValue({
      data: {
        id: subscriptionId,
        user_id: userId,
        current_period_end: '2026-04-30T00:00:00.000Z',
      },
      error: null,
    });
    db.insertTransaction.mockResolvedValue({
      data: { id: 'tx_1' },
      error: null,
    });
    db.insertEntitlement.mockResolvedValue({
      data: { id: 'ent_1' },
      error: null,
    });
    mockedEnqueueJob.mockResolvedValue({
      id: 'job_1',
      job_type: 'webhook',
      aggregate_id: 'evt_1',
      aggregate_type: 'stripe_event',
      payload: {},
      state: 'pending',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      email_id: null,
      error_message: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('returns duplicate=true when event already processed', async () => {
    db.getTransactionByStripeEventId.mockResolvedValueOnce({
      data: { id: 'tx_existing' },
      error: null,
    });

    const event = {
      id: 'evt_duplicate',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    } as unknown as Stripe.Event;

    const result = await handleStripeWebhookEvent(event);

    expect(result).toEqual({ duplicate: true, deadLettered: false });
    expect(db.insertTransaction).not.toHaveBeenCalled();
  });

  it('maps customer.subscription.created to subscription upsert + transaction + entitlement', async () => {
    const event = {
      id: 'evt_sub_created',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at: null,
          metadata: {
            user_id: userId,
            product_id: productId,
            price_id: priceId,
          },
          items: {
            data: [
              {
                price: { metadata: {} },
              },
            ],
          },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeWebhookEvent(event);

    expect(result).toEqual({ duplicate: false, deadLettered: false });
    expect(db.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        stripe_subscription_id: 'sub_123',
        status: 'active',
      })
    );
    expect(db.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_event_id: 'evt_sub_created',
        event_type: 'customer.subscription.created',
        status: 'succeeded',
      })
    );
    expect(db.insertEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        product_id: productId,
        source: 'subscription',
      })
    );
    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'send_email',
      expect.objectContaining({
        to: 'subscriber@example.com',
        data: { message: 'Welcome! Your subscription is active' },
      }),
      expect.objectContaining({
        aggregate_id: userId,
      })
    );
    expect(mockedAuditLog).toHaveBeenCalled();
  });

  it('maps customer.subscription.updated status to cancelled', async () => {
    const event = {
      id: 'evt_sub_updated',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'canceled',
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at: 1702600000,
          metadata: {
            user_id: userId,
          },
          items: {
            data: [{ price: { metadata: {} } }],
          },
        },
      },
    } as unknown as Stripe.Event;

    await handleStripeWebhookEvent(event);

    expect(db.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
      })
    );
    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'send_email',
      expect.objectContaining({
        to: 'subscriber@example.com',
        data: { message: 'Your subscription was cancelled; you have access until 2026-04-30' },
      }),
      expect.objectContaining({
        aggregate_id: userId,
      })
    );
  });

  it('maps customer.subscription.updated non-cancelled to billing updated notification', async () => {
    const event = {
      id: 'evt_sub_updated_active',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at: null,
          metadata: {
            user_id: userId,
          },
          items: {
            data: [{ price: { metadata: {} } }],
          },
        },
      },
    } as unknown as Stripe.Event;

    await handleStripeWebhookEvent(event);

    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'send_email',
      expect.objectContaining({
        to: 'subscriber@example.com',
        data: { message: 'Your billing information has been updated' },
      }),
      expect.objectContaining({
        aggregate_id: userId,
      })
    );
  });

  it('maps charge.refunded to refunded transaction', async () => {
    const event = {
      id: 'evt_refund',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_123',
          amount: 900,
          amount_refunded: 900,
          currency: 'usd',
          metadata: {
            user_id: userId,
            subscription_id: subscriptionId,
          },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeWebhookEvent(event);

    expect(result).toEqual({ duplicate: false, deadLettered: false });
    expect(db.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_event_id: 'evt_refund',
        event_type: 'charge.refunded',
        amount_cents: 900,
        currency: 'USD',
        status: 'refunded',
      })
    );
  });

  it('maps payment_intent.succeeded to succeeded transaction', async () => {
    const event = {
      id: 'evt_pi',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 1200,
          amount_received: 1200,
          currency: 'usd',
          metadata: {
            user_id: userId,
            subscription_id: subscriptionId,
          },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeWebhookEvent(event);

    expect(result).toEqual({ duplicate: false, deadLettered: false });
    expect(db.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_event_id: 'evt_pi',
        event_type: 'payment_intent.succeeded',
        amount_cents: 1200,
        currency: 'USD',
        status: 'succeeded',
      })
    );
  });

  it('maps invoice.payment_failed to failed transaction + notification', async () => {
    db.getSubscriptionByStripeId.mockResolvedValueOnce({
      data: {
        id: subscriptionId,
        user_id: userId,
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
        price_id: priceId,
        status: 'active',
        current_period_start: null,
        current_period_end: null,
        cancel_at: null,
      },
      error: null,
    });

    const event = {
      id: 'evt_failed',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_123',
          subscription: 'sub_123',
          customer: 'cus_123',
          amount_due: 5000,
          currency: 'usd',
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeWebhookEvent(event);
    expect(result).toEqual({ duplicate: false, deadLettered: false });

    expect(db.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_event_id: 'evt_failed',
        event_type: 'invoice.payment_failed',
        status: 'failed',
      })
    );
    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'send_email',
      expect.objectContaining({
        to: 'subscriber@example.com',
        data: { message: 'Payment failed; update payment method to avoid interruption' },
      }),
      expect.objectContaining({
        aggregate_id: userId,
      })
    );
  });

  it('dead-letters failures instead of throwing for subscription events', async () => {
    const event = {
      id: 'evt_missing_user',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at: null,
          metadata: {},
          items: {
            data: [{ price: { metadata: {} } }],
          },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeWebhookEvent(event);

    expect(result).toEqual({ duplicate: false, deadLettered: true });
    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'webhook',
      expect.objectContaining({
        kind: 'stripe_webhook_dead_letter',
        stripe_event_id: 'evt_missing_user',
      }),
      expect.objectContaining({
        aggregate_id: 'evt_missing_user',
        aggregate_type: 'stripe_event',
      })
    );
  });
});
