/** @jest-environment node */

import type Stripe from 'stripe';
import { getSupabaseClient } from '../src/lib/db/client';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { reconcileStripeSubscriptions } from '../src/lib/payments/reconciliation';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;

const userId = '11111111-1111-4111-8111-111111111111';

describe('reconcileStripeSubscriptions', () => {
  const db = {
    getSubscriptionByStripeId: jest.fn(),
    upsertSubscription: jest.fn(),
    getUserById: jest.fn(),
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

    db.getUserById.mockResolvedValue({
      data: {
        id: userId,
        email: 'subscriber@example.com',
      },
      error: null,
    });

    db.upsertSubscription.mockResolvedValue({
      data: {
        id: 'sub_local',
        user_id: userId,
        current_period_end: '2026-04-30T00:00:00.000Z',
      },
      error: null,
    });

    mockedEnqueueJob.mockResolvedValue({
      id: 'job_1',
      job_type: 'send_email',
      aggregate_id: userId,
      aggregate_type: 'user',
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

  it('corrects drift and queues notification when Stripe status differs', async () => {
    db.getSubscriptionByStripeId.mockResolvedValueOnce({
      data: {
        id: 'sub_local',
        user_id: userId,
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
        price_id: 'price_1',
        status: 'active',
        current_period_start: '2026-03-01T00:00:00.000Z',
        current_period_end: '2026-04-01T00:00:00.000Z',
        cancel_at: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      error: null,
    });

    const stripeClient = {
      subscriptions: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'sub_123',
              status: 'canceled',
              customer: 'cus_123',
              current_period_start: 1700000000,
              current_period_end: 1702592000,
              cancel_at: 1702592000,
            },
          ],
        }),
      },
    } as unknown as Stripe;

    const result = await reconcileStripeSubscriptions(stripeClient);

    expect(result).toEqual({
      checked: 1,
      corrected: 1,
      notificationsQueued: 1,
    });

    expect(db.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_subscription_id: 'sub_123',
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

  it('does not update or notify when there is no drift', async () => {
    db.getSubscriptionByStripeId.mockResolvedValueOnce({
      data: {
        id: 'sub_local',
        user_id: userId,
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
        price_id: 'price_1',
        status: 'active',
        current_period_start: '2023-11-14T22:13:20.000Z',
        current_period_end: '2023-12-14T22:13:20.000Z',
        cancel_at: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      error: null,
    });

    const stripeClient = {
      subscriptions: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'sub_123',
              status: 'active',
              customer: 'cus_123',
              current_period_start: 1700000000,
              current_period_end: 1702592000,
              cancel_at: null,
            },
          ],
        }),
      },
    } as unknown as Stripe;

    const result = await reconcileStripeSubscriptions(stripeClient);

    expect(result).toEqual({
      checked: 1,
      corrected: 0,
      notificationsQueued: 0,
    });
    expect(db.upsertSubscription).not.toHaveBeenCalled();
    expect(mockedEnqueueJob).not.toHaveBeenCalled();
  });
});
