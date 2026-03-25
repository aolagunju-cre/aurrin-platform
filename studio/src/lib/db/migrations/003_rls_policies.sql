-- Row-Level Security (RLS) Policies for Aurrin Platform
-- These policies enforce authorization at the database layer
-- All tables have RLS enabled and policies for each role type

-- Helper function to check if current user has a specific role
CREATE OR REPLACE FUNCTION has_role(role_name TEXT, scope_type TEXT DEFAULT NULL, scope_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  -- Get current user ID from JWT
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user has Admin role (global scope)
  IF EXISTS (
    SELECT 1 FROM role_assignments
    WHERE user_id = auth.uid()
    AND role = role_name
    AND scope = CASE
      WHEN scope_type IS NULL THEN 'global'
      ELSE scope_type
    END
    AND (scope_type IS NULL OR scoped_id = scope_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- Admin has all permissions
  IF EXISTS (
    SELECT 1 FROM role_assignments
    WHERE user_id = auth.uid()
    AND role = 'Admin'
    AND scope = 'global'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all core tables
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
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_jobs ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (has_role('Admin'))
  WITH CHECK (has_role('Admin'));

-- ROLE_ASSIGNMENTS TABLE POLICIES

CREATE POLICY "role_assignments_select_own" ON role_assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "role_assignments_select_admin" ON role_assignments
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "role_assignments_insert_admin" ON role_assignments
  FOR INSERT WITH CHECK (has_role('Admin'));

CREATE POLICY "role_assignments_update_admin" ON role_assignments
  FOR UPDATE USING (has_role('Admin'))
  WITH CHECK (has_role('Admin'));

CREATE POLICY "role_assignments_delete_admin" ON role_assignments
  FOR DELETE USING (has_role('Admin'));

-- EVENTS TABLE POLICIES

CREATE POLICY "events_select_all" ON events
  FOR SELECT USING (TRUE);

CREATE POLICY "events_insert_admin" ON events
  FOR INSERT WITH CHECK (has_role('Admin'));

CREATE POLICY "events_update_admin" ON events
  FOR UPDATE USING (has_role('Admin'))
  WITH CHECK (has_role('Admin'));

CREATE POLICY "events_delete_admin" ON events
  FOR DELETE USING (has_role('Admin'));

-- RUBRIC_TEMPLATES TABLE POLICIES

CREATE POLICY "rubric_templates_select_all" ON rubric_templates
  FOR SELECT USING (TRUE);

CREATE POLICY "rubric_templates_insert_admin" ON rubric_templates
  FOR INSERT WITH CHECK (has_role('Admin'));

CREATE POLICY "rubric_templates_update_admin" ON rubric_templates
  FOR UPDATE USING (has_role('Admin'))
  WITH CHECK (has_role('Admin'));

-- JUDGE_SCORES TABLE POLICIES

CREATE POLICY "judge_scores_select_own" ON judge_scores
  FOR SELECT USING (judge_id = auth.uid());

CREATE POLICY "judge_scores_select_admin" ON judge_scores
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "judge_scores_select_founder_published" ON judge_scores
  FOR SELECT USING (
    founder_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM events
      WHERE id = judge_scores.event_id
      AND scoring_published_at IS NOT NULL
    )
  );

CREATE POLICY "judge_scores_insert_judge" ON judge_scores
  FOR INSERT WITH CHECK (
    judge_id = auth.uid()
    AND has_role('Judge', 'event', event_id::text)
  );

CREATE POLICY "judge_scores_update_judge" ON judge_scores
  FOR UPDATE USING (
    judge_id = auth.uid()
    AND has_role('Judge', 'event', event_id::text)
  )
  WITH CHECK (
    judge_id = auth.uid()
    AND has_role('Judge', 'event', event_id::text)
  );

-- FOUNDER_APPLICATIONS TABLE POLICIES

CREATE POLICY "founder_applications_select_own" ON founder_applications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "founder_applications_select_admin" ON founder_applications
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "founder_applications_select_judge" ON founder_applications
  FOR SELECT USING (has_role('Judge'));

CREATE POLICY "founder_applications_update_own" ON founder_applications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- AUDIENCE_SESSIONS TABLE POLICIES

CREATE POLICY "audience_sessions_select_public" ON audience_sessions
  FOR SELECT USING (
    status = 'active'
    AND session_start AT TIME ZONE 'UTC' <= NOW() AT TIME ZONE 'UTC'
    AND session_end AT TIME ZONE 'UTC' >= NOW() AT TIME ZONE 'UTC'
  );

CREATE POLICY "audience_sessions_select_admin" ON audience_sessions
  FOR SELECT USING (has_role('Admin'));

-- AUDIENCE_RESPONSES TABLE POLICIES

CREATE POLICY "audience_responses_insert_public" ON audience_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM audience_sessions
      WHERE id = audience_responses.session_id
      AND status = 'active'
      AND session_start AT TIME ZONE 'UTC' <= NOW() AT TIME ZONE 'UTC'
      AND session_end AT TIME ZONE 'UTC' >= NOW() AT TIME ZONE 'UTC'
    )
  );

CREATE POLICY "audience_responses_select_founder" ON audience_responses
  FOR SELECT USING (
    founder_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM audience_sessions
      WHERE id = audience_responses.session_id
      AND published_at IS NOT NULL
    )
  );

CREATE POLICY "audience_responses_select_admin" ON audience_responses
  FOR SELECT USING (has_role('Admin'));

-- MENTOR_MATCHES TABLE POLICIES

CREATE POLICY "mentor_matches_select_own" ON mentor_matches
  FOR SELECT USING (
    mentor_id = auth.uid()
    OR founder_id = auth.uid()
  );

CREATE POLICY "mentor_matches_select_admin" ON mentor_matches
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "mentor_matches_insert_admin" ON mentor_matches
  FOR INSERT WITH CHECK (has_role('Admin'));

CREATE POLICY "mentor_matches_update_own" ON mentor_matches
  FOR UPDATE USING (
    (mentor_id = auth.uid() AND status IN ('pending', 'accepted'))
    OR (founder_id = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    (mentor_id = auth.uid() AND status IN ('pending', 'accepted'))
    OR (founder_id = auth.uid() AND status = 'pending')
  );

-- SUBSCRIPTIONS TABLE POLICIES

CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "subscriptions_select_admin" ON subscriptions
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "subscriptions_insert_public" ON subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- TRANSACTIONS TABLE POLICIES

CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM subscriptions
      WHERE id = transactions.subscription_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_select_admin" ON transactions
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "transactions_insert_system" ON transactions
  FOR INSERT WITH CHECK (TRUE);

-- AUDIT_LOGS TABLE POLICIES

CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "audit_logs_insert_system" ON audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- FILES TABLE POLICIES

CREATE POLICY "files_select_own" ON files
  FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "files_select_public" ON files
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "files_select_admin" ON files
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "files_insert_authenticated" ON files
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- OUTBOX_JOBS TABLE POLICIES

CREATE POLICY "outbox_jobs_select_admin" ON outbox_jobs
  FOR SELECT USING (has_role('Admin'));

CREATE POLICY "outbox_jobs_insert_system" ON outbox_jobs
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "outbox_jobs_update_system" ON outbox_jobs
  FOR UPDATE USING (TRUE)
  WITH CHECK (TRUE);
