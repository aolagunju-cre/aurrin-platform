-- Founder Sponsorship MVP: adds sponsorship_tiers and donations tables,
-- and extends founder_applications with phone, etransfer_email, and funding_goal_cents.
-- This migration is safe to re-run (all statements are idempotent).

-- ──────────────────────────────────────────────
-- Table: sponsorship_tiers
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsorship_tiers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label             TEXT        NOT NULL,
  amount_cents      INTEGER     NOT NULL,
  perk_description  TEXT        NOT NULL,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_tiers_founder_id
  ON sponsorship_tiers(founder_id);

-- ──────────────────────────────────────────────
-- Table: donations
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id                UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donor_email               TEXT,
  donor_user_id             UUID    REFERENCES users(id) ON DELETE SET NULL,
  tier_id                   UUID    REFERENCES sponsorship_tiers(id) ON DELETE SET NULL,
  amount_cents              INTEGER NOT NULL,
  stripe_payment_intent_id  TEXT,
  status                    TEXT    NOT NULL DEFAULT 'completed',
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT donations_status_check CHECK (status IN ('completed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_donations_founder_id
  ON donations(founder_id);

CREATE INDEX IF NOT EXISTS idx_donations_donor_user_id
  ON donations(donor_user_id);

CREATE INDEX IF NOT EXISTS idx_donations_stripe_payment_intent_id
  ON donations(stripe_payment_intent_id);

-- ──────────────────────────────────────────────
-- Extend: founder_applications
-- ──────────────────────────────────────────────
ALTER TABLE founder_applications
  ADD COLUMN IF NOT EXISTS phone               TEXT,
  ADD COLUMN IF NOT EXISTS etransfer_email     TEXT,
  ADD COLUMN IF NOT EXISTS funding_goal_cents  INTEGER;
