/** @jest-environment node */

import { hasEntitlement } from '../src/lib/payments/entitlements';
import { resetSupabaseClient, setSupabaseClient } from '../src/lib/db/client';

const userId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';

describe('hasEntitlement', () => {
  const listSubscriptionsByUserId = jest.fn();
  const listEntitlementsByUserId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setSupabaseClient({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        listSubscriptionsByUserId,
        listEntitlementsByUserId,
      } as never,
    });
  });

  afterEach(() => {
    resetSupabaseClient();
  });

  it('returns true for active subscription entitlement', async () => {
    listSubscriptionsByUserId.mockResolvedValueOnce({
      data: [
        {
          id: 'sub_1',
          user_id: userId,
          status: 'active',
          current_period_end: new Date(Date.now() + 3600_000).toISOString(),
        },
      ],
      error: null,
    });
    listEntitlementsByUserId.mockResolvedValueOnce({ data: [], error: null });

    await expect(hasEntitlement(userId, productId)).resolves.toBe(true);
  });

  it('returns false for cancelled/expired subscription with no entitlement row', async () => {
    listSubscriptionsByUserId.mockResolvedValueOnce({
      data: [
        {
          id: 'sub_2',
          user_id: userId,
          status: 'cancelled',
          current_period_end: new Date(Date.now() - 3600_000).toISOString(),
        },
      ],
      error: null,
    });
    listEntitlementsByUserId.mockResolvedValueOnce({ data: [], error: null });

    await expect(hasEntitlement(userId, productId)).resolves.toBe(false);
  });

  it('returns true for valid purchase entitlement', async () => {
    listSubscriptionsByUserId.mockResolvedValueOnce({ data: [], error: null });
    listEntitlementsByUserId.mockResolvedValueOnce({
      data: [
        {
          id: 'ent_1',
          user_id: userId,
          product_id: productId,
          source: 'purchase',
          expires_at: null,
        },
      ],
      error: null,
    });

    await expect(hasEntitlement(userId, productId)).resolves.toBe(true);
  });

  it('returns false when user has no active subscription or matching entitlement', async () => {
    listSubscriptionsByUserId.mockResolvedValueOnce({ data: [], error: null });
    listEntitlementsByUserId.mockResolvedValueOnce({
      data: [
        {
          id: 'ent_2',
          user_id: userId,
          product_id: '33333333-3333-4333-8333-333333333333',
          source: 'purchase',
          expires_at: null,
        },
      ],
      error: null,
    });

    await expect(hasEntitlement(userId, productId)).resolves.toBe(false);
  });

  it('returns true when multiple entitlement states include one valid matching source', async () => {
    listSubscriptionsByUserId.mockResolvedValueOnce({
      data: [
        {
          id: 'sub_legacy',
          user_id: userId,
          status: 'cancelled',
          current_period_end: new Date(Date.now() - 3600_000).toISOString(),
        },
      ],
      error: null,
    });
    listEntitlementsByUserId.mockResolvedValueOnce({
      data: [
        {
          id: 'ent_expired',
          user_id: userId,
          product_id: productId,
          source: 'subscription',
          expires_at: new Date(Date.now() - 3600_000).toISOString(),
        },
        {
          id: 'ent_active',
          user_id: userId,
          product_id: productId,
          source: 'purchase',
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
      ],
      error: null,
    });

    await expect(hasEntitlement(userId, productId)).resolves.toBe(true);
  });
});
