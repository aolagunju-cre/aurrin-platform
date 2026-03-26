import fs from 'node:fs';
import path from 'node:path';
import { getSupabaseClient, resetSupabaseClient } from '../src/lib/db/client';

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
