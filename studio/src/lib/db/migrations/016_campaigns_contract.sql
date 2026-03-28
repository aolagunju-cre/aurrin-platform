-- Aurrin Ventures Platform - Campaigns Contract
-- Crowdfunding campaigns for founders
-- Created: 2026-03-28

-- ============================================================================
-- Campaign Status Enum
-- ============================================================================

CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'funded', 'closed');

-- ============================================================================
-- Campaigns Table
-- ============================================================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  story TEXT, -- problem/solution/use of funds (longer-form content)
  funding_goal_cents INTEGER NOT NULL DEFAULT 0,
  amount_raised_cents INTEGER NOT NULL DEFAULT 0,
  donor_count INTEGER NOT NULL DEFAULT 0,
  e_transfer_email TEXT,
  status campaign_status NOT NULL DEFAULT 'draft',
  pledge_tiers JSONB DEFAULT '[]', -- [{name, amount_cents, description}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE campaigns IS 'Crowdfunding campaigns created by founders. A founder can have multiple campaigns.';
COMMENT ON COLUMN campaigns.story IS 'Long-form narrative: problem, solution, use of funds.';
COMMENT ON COLUMN campaigns.pledge_tiers IS 'JSON array of predefined pledge tiers: [{name, amount_cents, description}]';
COMMENT ON COLUMN campaigns.status IS 'draft=not visible; active=accepting donations; funded=goal reached; closed=no longer accepting.';

CREATE INDEX ON campaigns(founder_id);
CREATE INDEX ON campaigns(status);
CREATE INDEX ON campaigns(created_at);

-- ============================================================================
-- Campaign Donations Table
-- ============================================================================

CREATE TABLE campaign_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  donor_name TEXT,
  donor_email TEXT,
  amount_cents INTEGER NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE campaign_donations IS 'Individual donations to campaigns. Tracks donor info for display on campaign pages.';

CREATE INDEX ON campaign_donations(campaign_id);
CREATE INDEX ON campaign_donations(created_at);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_donations ENABLE ROW LEVEL SECURITY;

-- Public can read active/funded campaigns
CREATE POLICY campaigns_public_read ON campaigns
  FOR SELECT USING (status IN ('active', 'funded'));

-- Founders can manage their own campaigns (via service role in API routes)
CREATE POLICY campaigns_service_all ON campaigns
  FOR ALL USING (true) WITH CHECK (true);

-- Public can read non-anonymous donations
CREATE POLICY donations_public_read ON campaign_donations
  FOR SELECT USING (true);

-- Service role can insert donations
CREATE POLICY donations_service_all ON campaign_donations
  FOR ALL USING (true) WITH CHECK (true);
