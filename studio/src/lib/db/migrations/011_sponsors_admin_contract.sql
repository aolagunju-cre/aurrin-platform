-- Sponsor admin contract alignment for issue #127.
-- Adds tier/scope/pricing lifecycle fields and normalizes RLS policies:
-- - Public read-only visibility
-- - Admin full management

ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pricing_cents INTEGER NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE sponsors
  DROP CONSTRAINT IF EXISTS sponsors_tier_check,
  DROP CONSTRAINT IF EXISTS sponsors_scope_check,
  DROP CONSTRAINT IF EXISTS sponsors_status_check,
  DROP CONSTRAINT IF EXISTS sponsors_pricing_non_negative,
  DROP CONSTRAINT IF EXISTS sponsors_scope_event_constraint;

ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_tier_check CHECK (tier IN ('bronze', 'silver', 'gold')),
  ADD CONSTRAINT sponsors_scope_check CHECK (placement_scope IN ('event', 'site-wide')),
  ADD CONSTRAINT sponsors_status_check CHECK (status IN ('active', 'inactive')),
  ADD CONSTRAINT sponsors_pricing_non_negative CHECK (pricing_cents >= 0),
  ADD CONSTRAINT sponsors_scope_event_constraint CHECK (
    (placement_scope = 'event' AND event_id IS NOT NULL)
    OR (placement_scope = 'site-wide' AND event_id IS NULL)
  );

CREATE TABLE IF NOT EXISTS sponsor_tier_config (
  tier TEXT PRIMARY KEY,
  pricing_cents INTEGER NOT NULL CHECK (pricing_cents >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sponsor_tier_config (tier, pricing_cents)
VALUES
  ('bronze', 50000),
  ('silver', 100000),
  ('gold', 250000)
ON CONFLICT (tier) DO NOTHING;

UPDATE sponsors
SET tier = COALESCE(NULLIF(tier, ''), 'bronze');

UPDATE sponsors
SET pricing_cents = CASE tier
  WHEN 'silver' THEN 100000
  WHEN 'gold' THEN 250000
  ELSE 50000
END
WHERE pricing_cents IS NULL OR pricing_cents < 0;

CREATE INDEX IF NOT EXISTS sponsors_tier_idx ON sponsors(tier);
CREATE INDEX IF NOT EXISTS sponsors_status_idx ON sponsors(status);
CREATE INDEX IF NOT EXISTS sponsors_end_date_idx ON sponsors(end_date);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsors_admin_all ON sponsors;
DROP POLICY IF EXISTS sponsors_select ON sponsors;
DROP POLICY IF EXISTS sponsors_admin_manage ON sponsors;
DROP POLICY IF EXISTS sponsors_public_read ON sponsors;

CREATE POLICY sponsors_admin_manage ON sponsors
  FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role))
  WITH CHECK (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY sponsors_public_read ON sponsors
  FOR SELECT
  USING (TRUE);
