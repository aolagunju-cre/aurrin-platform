/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';
import { getSupabaseClient, resetSupabaseClient, setSupabaseClient } from '../src/lib/db/client';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { handleStripeWebhookEvent } from '../src/lib/payments/webhook-handler';
import { GET as getProductDownload } from '../src/app/api/products/[productId]/download/route';
import { getSignedUrlForEntitlement } from '../src/lib/storage/signedUrl';
import { auditLog } from '../src/lib/audit/log';

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

jest.mock('../src/lib/storage/signedUrl', () => ({
  SignedUrlError: class SignedUrlError extends Error {
    code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'STORAGE_ERROR';

    constructor(message: string, code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'STORAGE_ERROR') {
      super(message);
      this.code = code;
    }
  },
  getSignedUrlForEntitlement: jest.fn(),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn(),
}));

const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
const mockedGetSignedUrlForEntitlement = getSignedUrlForEntitlement as jest.MockedFunction<typeof getSignedUrlForEntitlement>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
const mockedAuditLog = auditLog as jest.MockedFunction<typeof auditLog>;

const migrationPath = path.resolve(process.cwd(), 'src/lib/db/migrations/007_commerce_contract.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('commerce migration contract', () => {
  test('defines required commerce tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS products');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS prices');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS entitlements');
  });

  test('uses exact subscription status enum values', () => {
    expect(migrationSql).toContain("CREATE TYPE commerce_subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'unpaid')");
  });

  test('enforces unique stripe_event_id for transaction idempotency', () => {
    expect(migrationSql).toContain('transactions_stripe_event_id_unique');
    expect(migrationSql).toContain('ON transactions(stripe_event_id)');
  });

  test('applies subscriber own/admin all subscription RLS policies', () => {
    expect(migrationSql).toContain('CREATE POLICY subscriptions_select_own ON subscriptions');
    expect(migrationSql).toContain('CREATE POLICY subscriptions_select_admin ON subscriptions');
    expect(migrationSql).toContain("role = 'admin'");
  });
});

describe('commerce db client contract', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    resetSupabaseClient();
  });

  afterAll(() => {
    process.env = originalEnv;
    resetSupabaseClient();
  });

  test('exposes commerce methods on db client surface', () => {
    const client = getSupabaseClient();
    expect(typeof client.db.listProducts).toBe('function');
    expect(typeof client.db.insertProduct).toBe('function');
    expect(typeof client.db.updateProduct).toBe('function');
    expect(typeof client.db.listPricesByProductId).toBe('function');
    expect(typeof client.db.insertPrice).toBe('function');
    expect(typeof client.db.updatePrice).toBe('function');
    expect(typeof client.db.getSubscriptionByStripeId).toBe('function');
    expect(typeof client.db.listSubscriptionsByUserId).toBe('function');
    expect(typeof client.db.upsertSubscription).toBe('function');
    expect(typeof client.db.getTransactionByStripeEventId).toBe('function');
    expect(typeof client.db.insertTransaction).toBe('function');
    expect(typeof client.db.listEntitlementsByUserId).toBe('function');
    expect(typeof client.db.insertEntitlement).toBe('function');
  });

  test('stubbed methods return configuration errors when Supabase env is unset', async () => {
    const client = getSupabaseClient();
    const result = await client.db.listProducts();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toEqual([]);
  });
});

describe('monetization purchase-to-download contract', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const fileId = '33333333-3333-4333-8333-333333333333';

  let transactions: Array<{ stripe_event_id: string }>;
  let entitlements: Array<{ user_id: string; product_id: string; source: string; expires_at: string | null }>;

  beforeEach(() => {
    jest.clearAllMocks();
    transactions = [];
    entitlements = [];

    mockedExtractTokenFromHeader.mockImplementation((header) => (header ? 'token' : null));
    mockedVerifyJWT.mockResolvedValue({
      sub: userId,
      email: 'buyer@example.com',
      iat: 0,
      exp: 9_999_999_999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });
    mockedGetSignedUrlForEntitlement.mockResolvedValue('https://signed.example/download');
    mockedEnqueueJob.mockResolvedValue({
      id: 'job_1',
      job_type: 'send_email',
      aggregate_id: productId,
      aggregate_type: 'product',
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
    mockedAuditLog.mockResolvedValue();

    setSupabaseClient({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        getTransactionByStripeEventId: async (stripeEventId: string) => ({
          data: transactions.find((transaction) => transaction.stripe_event_id === stripeEventId) ?? null,
          error: null,
        }),
        getSubscriptionByStripeId: async () => ({ data: null, error: null }),
        upsertSubscription: async () => ({ data: null, error: null }),
        insertTransaction: async (payload: { stripe_event_id: string }) => {
          transactions.push(payload);
          return { data: { id: `tx_${transactions.length}` }, error: null };
        },
        getProductById: async (id: string) => ({
          data: id === productId ? {
            id: productId,
            product_type: 'digital',
            access_type: 'perpetual',
            file_id: fileId,
          } : null,
          error: null,
        }),
        insertEntitlement: async (payload: {
          user_id: string;
          product_id: string;
          source: string;
          expires_at?: string | null;
        }) => {
          entitlements.push({
            user_id: payload.user_id,
            product_id: payload.product_id,
            source: payload.source,
            expires_at: payload.expires_at ?? null,
          });
          return { data: { id: `ent_${entitlements.length}` }, error: null };
        },
        listSubscriptionsByUserId: async () => ({ data: [], error: null }),
        listEntitlementsByUserId: async (id: string) => ({
          data: entitlements.filter((entitlement) => entitlement.user_id === id),
          error: null,
        }),
        getUserById: async () => ({
          data: { id: userId, email: 'buyer@example.com' },
          error: null,
        }),
      } as never,
    });
  });

  afterEach(() => {
    resetSupabaseClient();
  });

  test('payment success creates entitlement and enables signed download', async () => {
    const event = {
      id: 'evt_pi_purchase',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 4900,
          amount_received: 4900,
          currency: 'usd',
          metadata: {
            user_id: userId,
            product_id: productId,
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(handleStripeWebhookEvent(event)).resolves.toEqual({ duplicate: false, deadLettered: false });
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]).toEqual({
      user_id: userId,
      product_id: productId,
      source: 'purchase',
      expires_at: null,
    });

    const response = await getProductDownload(
      new NextRequest(`http://localhost/api/products/${productId}/download`, {
        headers: { authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ productId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        product_id: productId,
        signed_url: 'https://signed.example/download',
      },
    });
    expect(mockedGetSignedUrlForEntitlement).toHaveBeenCalledWith(fileId);
  });

  test('download request is rejected when entitlement is missing', async () => {
    const response = await getProductDownload(
      new NextRequest(`http://localhost/api/products/${productId}/download`, {
        headers: { authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ productId }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Entitlement required.' });
    expect(mockedGetSignedUrlForEntitlement).not.toHaveBeenCalled();
  });
});
