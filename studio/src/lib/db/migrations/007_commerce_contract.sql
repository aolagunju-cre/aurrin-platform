-- Commerce contract alignment for Stripe Phase 2.
-- Adds canonical products/prices/entitlements tables and normalizes
-- subscriptions/transactions schema to the PRD #42 contract.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_interval') THEN
    CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commerce_subscription_status') THEN
    CREATE TYPE commerce_subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'unpaid');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commerce_transaction_status') THEN
    CREATE TYPE commerce_transaction_status AS ENUM ('succeeded', 'failed', 'refunded');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entitlement_source') THEN
    CREATE TYPE entitlement_source AS ENUM ('subscription', 'purchase');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  stripe_product_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_stripe_product_id_key
  ON products (stripe_product_id)
  WHERE stripe_product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stripe_price_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval billing_interval NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS prices_stripe_price_id_key
  ON prices (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prices_product_id_idx ON prices(product_id);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS price_id UUID,
  ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_price_id_fkey'
      AND conrelid = 'subscriptions'::regclass
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_price_id_fkey
      FOREIGN KEY (price_id)
      REFERENCES prices(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE subscriptions
SET cancel_at = COALESCE(cancel_at, canceled_at)
WHERE canceled_at IS NOT NULL;

ALTER TABLE subscriptions
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE subscriptions
  ALTER COLUMN status TYPE commerce_subscription_status
  USING (
    CASE status::text
      WHEN 'active' THEN 'active'
      WHEN 'past_due' THEN 'past_due'
      WHEN 'canceled' THEN 'cancelled'
      WHEN 'paused' THEN 'unpaid'
      ELSE 'unpaid'
    END
  )::commerce_subscription_status,
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status commerce_transaction_status NOT NULL DEFAULT 'succeeded';

CREATE UNIQUE INDEX IF NOT EXISTS transactions_stripe_event_id_unique
  ON transactions(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  source entitlement_source NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entitlements_user_id_idx ON entitlements(user_id);
CREATE INDEX IF NOT EXISTS entitlements_product_id_idx ON entitlements(product_id);
CREATE INDEX IF NOT EXISTS entitlements_expires_at_idx ON entitlements(expires_at);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON subscriptions;
DROP POLICY IF EXISTS subscriptions_select_admin ON subscriptions;
DROP POLICY IF EXISTS subscriptions_own ON subscriptions;
DROP POLICY IF EXISTS subscriptions_admin_all ON subscriptions;

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY subscriptions_select_admin ON subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM role_assignments
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND scope = 'global'
    )
  );
