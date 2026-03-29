-- Aurrin Ventures Platform - Platform waitlist intake contract
-- Captures pre-launch demand for the crowdfunding platform.

CREATE TABLE platform_waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'public-waitlist',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE platform_waitlist_signups IS 'Pre-launch waitlist signups for the Aurrin crowdfunding platform.';
COMMENT ON COLUMN platform_waitlist_signups.email IS 'Normalized to lowercase before persistence to support idempotent intake.';
COMMENT ON COLUMN platform_waitlist_signups.source IS 'Origin of the signup request (for example public-waitlist or aurrin-app-v2).';
COMMENT ON COLUMN platform_waitlist_signups.metadata IS 'Optional structured submission context for future segmentation.';

CREATE INDEX idx_platform_waitlist_signups_created_at
  ON platform_waitlist_signups(created_at DESC);

CREATE INDEX idx_platform_waitlist_signups_source
  ON platform_waitlist_signups(source);

CREATE TRIGGER platform_waitlist_signups_update_timestamp
BEFORE UPDATE ON platform_waitlist_signups
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

ALTER TABLE platform_waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_waitlist_signups_admin_select ON platform_waitlist_signups
  FOR SELECT USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY platform_waitlist_signups_admin_update ON platform_waitlist_signups
  FOR UPDATE
  USING (has_role(auth.current_user_id(), 'admin'::user_role))
  WITH CHECK (has_role(auth.current_user_id(), 'admin'::user_role));
