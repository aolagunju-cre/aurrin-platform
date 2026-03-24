-- Row-Level Security (RLS) Policies
-- Aurrin Ventures Platform - PostgreSQL via Supabase
-- Created: 2026-03-24

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper functions for RLS policies
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS UUID AS $$
  SELECT COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
  );
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION auth.current_user_id IS 'Get the current authenticated user ID from Supabase Auth or JWT.';

-- ============================================================================
-- USERS Table Policies
-- ============================================================================

CREATE POLICY users_select_own ON users FOR SELECT
  USING (id = auth.current_user_id());

CREATE POLICY users_select_admin ON users FOR SELECT
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY users_update_own ON users FOR UPDATE
  USING (id = auth.current_user_id());

CREATE POLICY users_update_admin ON users FOR UPDATE
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

-- ============================================================================
-- ROLE_ASSIGNMENTS Table Policies (Admin only)
-- ============================================================================

CREATE POLICY role_assignments_admin_select ON role_assignments FOR SELECT
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY role_assignments_admin_insert ON role_assignments FOR INSERT
  WITH CHECK (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY role_assignments_admin_update ON role_assignments FOR UPDATE
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY role_assignments_admin_delete ON role_assignments FOR DELETE
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

-- ============================================================================
-- EVENTS Table Policies
-- ============================================================================

-- Admin: see all
-- Judge/Founder: see assigned events
-- Everyone: see public upcoming events

CREATE POLICY events_admin_all ON events FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY events_judge_assigned ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM role_assignments
      WHERE user_id = auth.current_user_id()
        AND role = 'judge'::user_role
        AND scope = 'event'::role_scope
        AND scoped_id = events.id
    )
  );

CREATE POLICY events_founder_assigned ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM role_assignments
      WHERE user_id = auth.current_user_id()
        AND role = 'founder'::user_role
        AND scope = 'event'::role_scope
        AND scoped_id = events.id
    )
  );

CREATE POLICY events_public_upcoming ON events FOR SELECT
  USING (status = 'upcoming'::event_status);

-- ============================================================================
-- RUBRIC Tables Policies
-- ============================================================================

CREATE POLICY rubric_templates_admin_all ON rubric_templates FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY rubric_templates_read_assigned ON rubric_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rubric_versions rv
      INNER JOIN events e ON rv.event_id = e.id
      WHERE rv.rubric_template_id = rubric_templates.id
        AND (
          has_role(auth.current_user_id(), 'admin'::user_role)
          OR has_role(auth.current_user_id(), 'judge'::user_role, 'event'::role_scope, e.id)
        )
    )
  );

CREATE POLICY rubric_versions_admin_all ON rubric_versions FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY rubric_versions_read_assigned ON rubric_versions FOR SELECT
  USING (
    has_role(auth.current_user_id(), 'judge'::user_role, 'event'::role_scope, event_id)
    OR has_role(auth.current_user_id(), 'founder'::user_role, 'event'::role_scope, event_id)
  );

-- ============================================================================
-- FOUNDER_APPLICATIONS Table Policies
-- ============================================================================

CREATE POLICY founder_applications_admin_all ON founder_applications FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

-- Applicants can only see their own
CREATE POLICY founder_applications_public_insert ON founder_applications FOR INSERT
  WITH CHECK (true); -- Anyone can apply

-- ============================================================================
-- FOUNDERS & FOUNDER_PITCHES Table Policies
-- ============================================================================

CREATE POLICY founders_admin_all ON founders FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY founders_own ON founders FOR SELECT
  USING (user_id = auth.current_user_id());

CREATE POLICY founder_pitches_admin_all ON founder_pitches FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

-- Founder sees their own pitches
CREATE POLICY founder_pitches_own_all ON founder_pitches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM founders
      WHERE founders.id = founder_pitches.founder_id
        AND founders.user_id = auth.current_user_id()
    )
  );

-- Judge sees pitches at assigned events
CREATE POLICY founder_pitches_judge ON founder_pitches FOR SELECT
  USING (
    has_role(auth.current_user_id(), 'judge'::user_role, 'event'::role_scope, event_id)
  );

-- Published pitches visible to public
CREATE POLICY founder_pitches_published ON founder_pitches FOR SELECT
  USING (is_published = TRUE);

-- ============================================================================
-- JUDGE_SCORES Table Policies
-- ============================================================================

CREATE POLICY judge_scores_admin_all ON judge_scores FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

-- Judge sees own scores
CREATE POLICY judge_scores_own ON judge_scores FOR ALL
  USING (judge_id = auth.current_user_id());

-- Founder sees own scores after publish
CREATE POLICY judge_scores_founder ON judge_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM founder_pitches fp
      INNER JOIN founders f ON fp.founder_id = f.id
      WHERE fp.id = judge_scores.founder_pitch_id
        AND f.user_id = auth.current_user_id()
        AND fp.is_published = TRUE
    )
  );

-- ============================================================================
-- AUDIENCE Tables Policies
-- ============================================================================

CREATE POLICY audience_sessions_public_insert ON audience_sessions FOR INSERT
  WITH CHECK (true); -- Public can create sessions

CREATE POLICY audience_sessions_admin_all ON audience_sessions FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY audience_sessions_own ON audience_sessions FOR SELECT
  USING (TRUE); -- Sessions are public reads for now

CREATE POLICY audience_responses_public_insert ON audience_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY audience_responses_admin_all ON audience_responses FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY audience_responses_founder ON audience_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM founder_pitches fp
      INNER JOIN founders f ON fp.founder_id = f.id
      WHERE fp.id = audience_responses.founder_pitch_id
        AND f.user_id = auth.current_user_id()
        AND fp.is_published = TRUE
    )
  );

-- ============================================================================
-- MENTOR_MATCHES Table Policies
-- ============================================================================

CREATE POLICY mentor_matches_admin_all ON mentor_matches FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

-- Mentor sees own matches
CREATE POLICY mentor_matches_mentor ON mentor_matches FOR SELECT
  USING (mentor_id = auth.current_user_id());

-- Founder sees own matches
CREATE POLICY mentor_matches_founder ON mentor_matches FOR SELECT
  USING (
    founder_id = (
      SELECT id FROM founders WHERE user_id = auth.current_user_id()
    )
  );

-- ============================================================================
-- COMMERCE Tables Policies
-- ============================================================================

CREATE POLICY digital_products_admin_all ON digital_products FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY digital_products_select ON digital_products FOR SELECT
  USING (TRUE); -- Products are public

CREATE POLICY subscriptions_admin_all ON subscriptions FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY subscriptions_own ON subscriptions FOR SELECT
  USING (user_id = auth.current_user_id());

CREATE POLICY orders_admin_all ON orders FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY orders_own ON orders FOR SELECT
  USING (user_id = auth.current_user_id());

CREATE POLICY orders_own_insert ON orders FOR INSERT
  WITH CHECK (user_id = auth.current_user_id() OR user_id IS NULL);

CREATE POLICY transactions_admin_all ON transactions FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY transactions_own ON transactions FOR SELECT
  USING (user_id = auth.current_user_id());

-- ============================================================================
-- FILES Table Policies
-- ============================================================================

CREATE POLICY files_admin_all ON files FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY files_own ON files FOR ALL
  USING (owner_id = auth.current_user_id());

CREATE POLICY files_public ON files FOR SELECT
  USING (is_public = TRUE);

-- ============================================================================
-- OUTBOX_JOBS Table Policies (Admin only)
-- ============================================================================

CREATE POLICY outbox_jobs_admin_all ON outbox_jobs FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

-- Worker can see pending jobs (in service role context)
-- This policy is typically bypassed with service_role

-- ============================================================================
-- AUDIT_LOGS Table Policies (Admin only, immutable)
-- ============================================================================

CREATE POLICY audit_logs_admin_select ON audit_logs FOR SELECT
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY audit_logs_admin_insert ON audit_logs FOR INSERT
  WITH CHECK (has_role(auth.current_user_id(), 'admin'::user_role));

-- No UPDATE or DELETE on audit logs - immutable by policy

-- ============================================================================
-- SPONSORS Table Policies
-- ============================================================================

CREATE POLICY sponsors_admin_all ON sponsors FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY sponsors_select ON sponsors FOR SELECT
  USING (TRUE); -- Public

-- ============================================================================
-- DONE
-- ============================================================================

-- All RLS policies are now in place. Update your Supabase JWT secret
-- and test authorization with different user roles.
