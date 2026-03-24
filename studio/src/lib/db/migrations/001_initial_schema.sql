-- Aurrin Ventures Platform - Initial Database Schema
-- PostgreSQL via Supabase
-- Created: 2026-03-24

-- ============================================================================
-- Enums & Types
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'judge', 'founder', 'mentor', 'subscriber', 'audience');
CREATE TYPE role_scope AS ENUM ('global', 'event', 'founder', 'subscriber');
CREATE TYPE event_status AS ENUM ('upcoming', 'live', 'archived');
CREATE TYPE founder_application_status AS ENUM ('pending', 'accepted', 'assigned', 'declined');
CREATE TYPE outbox_job_state AS ENUM ('pending', 'processing', 'completed', 'failed', 'dead_letter');
CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'canceled', 'past_due');

-- ============================================================================
-- Identity & Access Tables
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE users IS 'User identity profiles. Authentication state managed by Supabase Auth.';
COMMENT ON COLUMN users.id IS 'Primary key, generated UUID.';
COMMENT ON COLUMN users.email IS 'User email, unique, used for Supabase Auth identity.';

CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  scope role_scope NOT NULL DEFAULT 'global',
  scoped_id UUID, -- event_id, founder_id, or subscription_id depending on scope
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(user_id, role, scope, scoped_id)
);

COMMENT ON TABLE role_assignments IS 'Authorization mapping. Source of truth for who has which role and scope. All changes audited.';
COMMENT ON COLUMN role_assignments.scope IS 'global=admin role; event=event-scoped judge/founder; founder=founder-level access; subscriber=subscription-level access.';
COMMENT ON COLUMN role_assignments.scoped_id IS 'References specific resource (event_id, founder_id, etc) if scope is not global.';

CREATE INDEX ON role_assignments(user_id);
CREATE INDEX ON role_assignments(role);
CREATE INDEX ON role_assignments(scope);

-- ============================================================================
-- Event Management Tables
-- ============================================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status event_status NOT NULL DEFAULT 'upcoming',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scoring_opens_at TIMESTAMP WITH TIME ZONE,
  scoring_closes_at TIMESTAMP WITH TIME ZONE,
  results_published_at TIMESTAMP WITH TIME ZONE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE events IS 'Monthly pitch events with lifecycle: Upcoming → Live → Archived. Owns judge assignments, scoring windows, validation config.';
COMMENT ON COLUMN events.status IS 'Event lifecycle. Controls which operations are allowed.';
COMMENT ON COLUMN events.config IS 'Event-specific configuration: sponsor slots, validation settings, etc. JSON for flexibility.';

CREATE INDEX ON events(status);
CREATE INDEX ON events(starts_at);

-- ============================================================================
-- Rubrics & Scoring Tables
-- ============================================================================

CREATE TABLE rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE rubric_templates IS 'Template for scoring rubrics. Admin defines questions, categories, scales, weights.';

CREATE TABLE rubric_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_template_id UUID NOT NULL REFERENCES rubric_templates(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id),
  version INT NOT NULL,
  definition JSONB NOT NULL, -- {categories: [{name, weight, questions: [{text, scale, type}]}]}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rubric_template_id, version)
);

COMMENT ON TABLE rubric_versions IS 'Immutable versioned rubrics. Live events reference a frozen version_id, not the template.';
COMMENT ON COLUMN rubric_versions.definition IS 'JSON structure: {categories: [...], weights: {...}} Preserves exact scoring rules at event time.';

CREATE INDEX ON rubric_versions(rubric_template_id);
CREATE INDEX ON rubric_versions(event_id);

-- ============================================================================
-- Founder Management Tables
-- ============================================================================

CREATE TABLE founder_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  status founder_application_status NOT NULL DEFAULT 'pending',
  application_data JSONB DEFAULT '{}',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE founder_applications IS 'Application form submissions. Status: Pending → Accepted → Assigned → Declined. Acceptance creates user account.';
COMMENT ON COLUMN founder_applications.status IS 'Workflow: pending (initial) → accepted (approved) → assigned (to event) → declined (rejected).';

CREATE INDEX ON founder_applications(status);
CREATE INDEX ON founder_applications(created_at);

CREATE TABLE founders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  tagline TEXT,
  bio TEXT,
  website TEXT,
  pitch_deck_url TEXT,
  social_proof JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE founders IS 'Founder profiles. Created when application accepted.';

CREATE INDEX ON founders(user_id);

CREATE TABLE founder_pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pitch_order INT,
  pitch_deck_url TEXT,
  score_aggregate NUMERIC(5, 2),
  score_breakdown JSONB,
  validation_summary JSONB DEFAULT '{}',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(founder_id, event_id)
);

COMMENT ON TABLE founder_pitches IS 'Founder pitch at event. Owns score aggregates, validation results, public directory highlights.';
COMMENT ON COLUMN founder_pitches.score_aggregate IS 'Calculated average of all judge scores.';
COMMENT ON COLUMN founder_pitches.is_published IS 'Founder can see scores only after publish=true.';

CREATE INDEX ON founder_pitches(founder_id);
CREATE INDEX ON founder_pitches(event_id);
CREATE INDEX ON founder_pitches(is_published);

-- ============================================================================
-- Scoring Tables
-- ============================================================================

CREATE TABLE judge_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  founder_pitch_id UUID NOT NULL REFERENCES founder_pitches(id) ON DELETE CASCADE,
  rubric_version_id UUID NOT NULL REFERENCES rubric_versions(id),
  responses JSONB NOT NULL, -- {[category_id]: {[question_id]: score}}
  comment TEXT,
  is_submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  revision_number INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(judge_id, founder_pitch_id)
);

COMMENT ON TABLE judge_scores IS 'Per-judge, per-founder, per-event scoring. References frozen rubric_version (not dynamic).';
COMMENT ON COLUMN judge_scores.rubric_version_id IS 'Immutable reference. Ensures scoring against version live at time of event.';
COMMENT ON COLUMN judge_scores.responses IS 'Normalized category/question/score structure. Matches rubric_version.definition schema.';

CREATE INDEX ON judge_scores(judge_id);
CREATE INDEX ON judge_scores(founder_pitch_id);
CREATE INDEX ON judge_scores(is_submitted);

-- ============================================================================
-- Audience Validation Tables
-- ============================================================================

CREATE TABLE audience_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  rate_limit_count INT DEFAULT 0,
  rate_limit_reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

COMMENT ON TABLE audience_sessions IS 'Server-issued session tokens for public QR validation. Enables dedup and optional contact collection.';

CREATE INDEX ON audience_sessions(event_id);
CREATE INDEX ON audience_sessions(session_token);
CREATE INDEX ON audience_sessions(created_at);

CREATE TABLE audience_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_session_id UUID NOT NULL REFERENCES audience_sessions(id) ON DELETE CASCADE,
  founder_pitch_id UUID NOT NULL REFERENCES founder_pitches(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  response_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(audience_session_id, founder_pitch_id, question_id)
);

COMMENT ON TABLE audience_responses IS 'Audience validation feedback. One response per session/founder/question. Enables dedup.';

CREATE INDEX ON audience_responses(founder_pitch_id);
CREATE INDEX ON audience_responses(created_at);

-- ============================================================================
-- Mentor Matching Tables
-- ============================================================================

CREATE TABLE mentor_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id),
  status TEXT DEFAULT 'pending_mentor', -- pending_mentor, pending_founder, accepted, declined
  mentor_accepted_at TIMESTAMP WITH TIME ZONE,
  founder_accepted_at TIMESTAMP WITH TIME ZONE,
  intro_email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mentor_id, founder_id, event_id)
);

COMMENT ON TABLE mentor_matches IS 'Mentor-founder pairing with repeat prevention. Both parties must accept. Intro email on mutual acceptance.';

CREATE INDEX ON mentor_matches(mentor_id);
CREATE INDEX ON mentor_matches(founder_id);
CREATE INDEX ON mentor_matches(status);

-- ============================================================================
-- Commerce Tables
-- ============================================================================

CREATE TABLE digital_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripe_price_id TEXT,
  fulfillment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE digital_products IS 'Paid digital assets: maps, reports, downloads. Linked to Stripe prices for fulfillment.';

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  status subscription_status DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE subscriptions IS 'Stripe-managed subscriptions. Status synced via webhooks.';

CREATE INDEX ON subscriptions(user_id);
CREATE INDEX ON subscriptions(status);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_checkout_session_id TEXT,
  digital_product_id UUID REFERENCES digital_products(id),
  subscription_id UUID REFERENCES subscriptions(id),
  total_cents INT NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE orders IS 'Purchase orders for digital products and subscriptions. Links to Stripe checkout sessions.';

CREATE INDEX ON orders(user_id);
CREATE INDEX ON orders(status);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL, -- checkout.session.completed, customer.subscription.updated, etc.
  amount_cents INT,
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE transactions IS 'Append-only ledger of Stripe events. System of record for reconciliation and exports.';

CREATE INDEX ON transactions(user_id);
CREATE INDEX ON transactions(order_id);
CREATE INDEX ON transactions(created_at);

-- ============================================================================
-- File Storage Tables
-- ============================================================================

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  storage_path TEXT UNIQUE NOT NULL,
  signed_url_expiry INT, -- seconds
  retention_days INT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days')
);

COMMENT ON TABLE files IS 'Metadata for pitch decks, generated PDFs, social assets. Stores signed-URL policy and retention rules.';
COMMENT ON COLUMN files.storage_path IS 'Path in Supabase Storage bucket.';
COMMENT ON COLUMN files.signed_url_expiry IS 'Expiration time for generated signed URLs (seconds).';

CREATE INDEX ON files(owner_id);
CREATE INDEX ON files(created_at);
CREATE INDEX ON files(expires_at);

-- ============================================================================
-- Background Jobs Tables
-- ============================================================================

CREATE TABLE outbox_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- email, pdf_generate, social_asset, export, mentor_match, webhook
  aggregate_id UUID,
  aggregate_type TEXT,
  payload JSONB NOT NULL,
  state outbox_job_state NOT NULL DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  last_error TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE outbox_jobs IS 'Durable async workflow state. Transactionally persisted with domain events. Supports retries, dead-letter queue, worker processing.';
COMMENT ON COLUMN outbox_jobs.job_type IS 'Type: email (Resend), pdf_generate, social_asset (Satori), export, mentor_match, webhook (Stripe).';
COMMENT ON COLUMN outbox_jobs.state IS 'pending → processing → completed | failed → dead_letter';

CREATE INDEX ON outbox_jobs(state);
CREATE INDEX ON outbox_jobs(job_type);
CREATE INDEX ON outbox_jobs(scheduled_at);
CREATE INDEX ON outbox_jobs(created_at);

-- ============================================================================
-- Audit Logging Tables
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL, -- approve_application, lock_scores, publish_results, change_role, export_data, etc.
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Immutable, append-only. Tracks approvals, role changes, score locks, entitlement changes, exports. Core compliance record.';
COMMENT ON COLUMN audit_logs.action IS 'The operation performed: approve_application, lock_scores, publish_results, change_role, create_export, etc.';
COMMENT ON COLUMN audit_logs.changes IS 'What changed: {before: {...}, after: {...}} for auditable state mutations.';

CREATE INDEX ON audit_logs(actor_id);
CREATE INDEX ON audit_logs(action);
CREATE INDEX ON audit_logs(resource_type);
CREATE INDEX ON audit_logs(created_at);

-- ============================================================================
-- Sponsorship Tables
-- ============================================================================

CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  placement_scope TEXT NOT NULL DEFAULT 'event', -- event or site-wide
  event_id UUID REFERENCES events(id),
  display_priority INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE sponsors IS 'Event sponsors and site-wide sponsors. Admin-managed, no self-serve. Placement scope: event-specific or site-wide.';

CREATE INDEX ON sponsors(placement_scope);
CREATE INDEX ON sponsors(event_id);

-- ============================================================================
-- Trigger Functions for Automatic Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_timestamp BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER role_assignments_update_timestamp BEFORE UPDATE ON role_assignments
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER events_update_timestamp BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER founder_applications_update_timestamp BEFORE UPDATE ON founder_applications
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER founders_update_timestamp BEFORE UPDATE ON founders
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER founder_pitches_update_timestamp BEFORE UPDATE ON founder_pitches
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER judge_scores_update_timestamp BEFORE UPDATE ON judge_scores
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER mentor_matches_update_timestamp BEFORE UPDATE ON mentor_matches
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER subscriptions_update_timestamp BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER outbox_jobs_update_timestamp BEFORE UPDATE ON outbox_jobs
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER sponsors_update_timestamp BEFORE UPDATE ON sponsors
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- Helper Functions for Authorization
-- ============================================================================

CREATE OR REPLACE FUNCTION has_role(p_user_id UUID, p_role user_role, p_scope role_scope DEFAULT 'global', p_scoped_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM role_assignments
    WHERE user_id = p_user_id
      AND role = p_role
      AND scope = p_scope
      AND (p_scoped_id IS NULL OR scoped_id = p_scoped_id)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION has_role IS 'Check if user has a specific role with optional scoping.';
