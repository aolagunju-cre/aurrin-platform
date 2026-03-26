/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getSubscriberSubscriptions } from '../src/app/api/subscriber/subscriptions/route';
import { POST as postSubscriptionCancel } from '../src/app/api/subscriber/subscriptions/[id]/cancel/route';
import { GET as getContentById } from '../src/app/api/content/[id]/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';
import { hasEntitlement } from '../src/lib/payments/entitlements';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

jest.mock('../src/lib/payments/entitlements', () => ({
  hasEntitlement: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
const mockedHasEntitlement = hasEntitlement as jest.MockedFunction<typeof hasEntitlement>;

describe('subscriber + content API routes', () => {
  const db = {
    listSubscriptionsByUserId: jest.fn(),
    getSubscriptionById: jest.fn(),
    requestSubscriptionCancellation: jest.fn(),
    getContentById: jest.fn(),
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

    mockedExtractTokenFromHeader.mockImplementation((header) => (header ? 'token' : null));
    mockedVerifyJWT.mockResolvedValue({
      sub: 'user-1',
      email: 'subscriber@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });
    mockedHasEntitlement.mockResolvedValue(true);
  });

  it('GET /api/subscriber/subscriptions is user scoped', async () => {
    db.listSubscriptionsByUserId.mockResolvedValueOnce({
      data: [{ id: 'sub_1', user_id: 'user-1' }],
      error: null,
    });

    const request = new NextRequest('http://localhost/api/subscriber/subscriptions', {
      method: 'GET',
      headers: { authorization: 'Bearer token' },
    });
    const response = await getSubscriberSubscriptions(request);

    expect(response.status).toBe(200);
    expect(db.listSubscriptionsByUserId).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ id: 'sub_1', user_id: 'user-1' }],
    });
  });

  it('GET /api/subscriber/subscriptions returns 401 for missing auth', async () => {
    mockedExtractTokenFromHeader.mockReturnValueOnce(null);

    const request = new NextRequest('http://localhost/api/subscriber/subscriptions', { method: 'GET' });
    const response = await getSubscriberSubscriptions(request);

    expect(response.status).toBe(401);
  });

  it('POST /api/subscriber/subscriptions/[id]/cancel enforces ownership', async () => {
    db.getSubscriptionById.mockResolvedValueOnce({
      data: {
        id: 'sub_x',
        user_id: 'other-user',
        stripe_subscription_id: 'sub_stripe',
      },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/subscriber/subscriptions/sub_x/cancel', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
    });
    const response = await postSubscriptionCancel(request, { params: Promise.resolve({ id: 'sub_x' }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Forbidden' });
  });

  it('POST /api/subscriber/subscriptions/[id]/cancel records cancellation request', async () => {
    db.getSubscriptionById.mockResolvedValueOnce({
      data: {
        id: 'sub_1',
        user_id: 'user-1',
        stripe_subscription_id: 'sub_stripe',
      },
      error: null,
    });
    db.requestSubscriptionCancellation.mockResolvedValueOnce({
      data: {
        id: 'sub_1',
        status: 'cancelled',
        cancel_at: '2026-03-26T00:00:00.000Z',
      },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/subscriber/subscriptions/sub_1/cancel', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
    });
    const response = await postSubscriptionCancel(request, { params: Promise.resolve({ id: 'sub_1' }) });

    expect(response.status).toBe(200);
    expect(db.requestSubscriptionCancellation).toHaveBeenCalledWith('sub_1');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: 'sub_1',
        status: 'cancelled',
        cancel_at: '2026-03-26T00:00:00.000Z',
      },
    });
  });

  it('GET /api/content/[id] returns 403 for premium content without entitlement', async () => {
    db.getContentById.mockResolvedValueOnce({
      data: {
        id: 'content_1',
        product_id: 'prod_1',
        requires_subscription: true,
      },
      error: null,
    });
    mockedHasEntitlement.mockResolvedValueOnce(false);

    const request = new NextRequest('http://localhost/api/content/content_1', {
      method: 'GET',
      headers: { authorization: 'Bearer token' },
    });
    const response = await getContentById(request, { params: Promise.resolve({ id: 'content_1' }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Subscription required' });
  });
});
