-- Rollback Migration 001_initial_schema
-- Safe reverse of schema setup
-- Created: 2026-03-24

-- ============================================================================
-- Drop RLS policies first (they reference tables)
-- ============================================================================

DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_select_admin ON users;
DROP POLICY IF EXISTS users_update_own ON users;
DROP POLICY IF EXISTS users_update_admin ON users;

DROP POLICY IF EXISTS role_assignments_admin_select ON role_assignments;
DROP POLICY IF EXISTS role_assignments_admin_insert ON role_assignments;
DROP POLICY IF EXISTS role_assignments_admin_update ON role_assignments;
DROP POLICY IF EXISTS role_assignments_admin_delete ON role_assignments;

DROP POLICY IF EXISTS events_admin_all ON events;
DROP POLICY IF EXISTS events_judge_assigned ON events;
DROP POLICY IF EXISTS events_founder_assigned ON events;
DROP POLICY IF EXISTS events_public_upcoming ON events;

DROP POLICY IF EXISTS rubric_templates_admin_all ON rubric_templates;
DROP POLICY IF EXISTS rubric_templates_read_assigned ON rubric_templates;
DROP POLICY IF EXISTS rubric_versions_admin_all ON rubric_versions;
DROP POLICY IF EXISTS rubric_versions_read_assigned ON rubric_versions;

DROP POLICY IF EXISTS founder_applications_admin_all ON founder_applications;
DROP POLICY IF EXISTS founder_applications_public_insert ON founder_applications;

DROP POLICY IF EXISTS founders_admin_all ON founders;
DROP POLICY IF EXISTS founders_own ON founders;

DROP POLICY IF EXISTS founder_pitches_admin_all ON founder_pitches;
DROP POLICY IF EXISTS founder_pitches_own_all ON founder_pitches;
DROP POLICY IF EXISTS founder_pitches_judge ON founder_pitches;
DROP POLICY IF EXISTS founder_pitches_published ON founder_pitches;

DROP POLICY IF EXISTS judge_scores_admin_all ON judge_scores;
DROP POLICY IF EXISTS judge_scores_own ON judge_scores;
DROP POLICY IF EXISTS judge_scores_founder ON judge_scores;

DROP POLICY IF EXISTS audience_sessions_public_insert ON audience_sessions;
DROP POLICY IF EXISTS audience_sessions_admin_all ON audience_sessions;
DROP POLICY IF EXISTS audience_sessions_own ON audience_sessions;

DROP POLICY IF EXISTS audience_responses_public_insert ON audience_responses;
DROP POLICY IF EXISTS audience_responses_admin_all ON audience_responses;
DROP POLICY IF EXISTS audience_responses_founder ON audience_responses;

DROP POLICY IF EXISTS mentor_matches_admin_all ON mentor_matches;
DROP POLICY IF EXISTS mentor_matches_mentor ON mentor_matches;
DROP POLICY IF EXISTS mentor_matches_founder ON mentor_matches;

DROP POLICY IF EXISTS digital_products_admin_all ON digital_products;
DROP POLICY IF EXISTS digital_products_select ON digital_products;

DROP POLICY IF EXISTS subscriptions_admin_all ON subscriptions;
DROP POLICY IF EXISTS subscriptions_own ON subscriptions;

DROP POLICY IF EXISTS orders_admin_all ON orders;
DROP POLICY IF EXISTS orders_own ON orders;
DROP POLICY IF EXISTS orders_own_insert ON orders;

DROP POLICY IF EXISTS transactions_admin_all ON transactions;
DROP POLICY IF EXISTS transactions_own ON transactions;

DROP POLICY IF EXISTS files_admin_all ON files;
DROP POLICY IF EXISTS files_own ON files;
DROP POLICY IF EXISTS files_public ON files;

DROP POLICY IF EXISTS outbox_jobs_admin_all ON outbox_jobs;

DROP POLICY IF EXISTS audit_logs_admin_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_admin_insert ON audit_logs;

DROP POLICY IF EXISTS sponsors_admin_all ON sponsors;
DROP POLICY IF EXISTS sponsors_select ON sponsors;

-- ============================================================================
-- Disable RLS on tables
-- ============================================================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE founder_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE founders DISABLE ROW LEVEL SECURITY;
ALTER TABLE founder_pitches DISABLE ROW LEVEL SECURITY;
ALTER TABLE judge_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE audience_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audience_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE digital_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE files DISABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Drop triggers and functions
-- ============================================================================

DROP TRIGGER IF EXISTS users_update_timestamp ON users;
DROP TRIGGER IF EXISTS role_assignments_update_timestamp ON role_assignments;
DROP TRIGGER IF EXISTS events_update_timestamp ON events;
DROP TRIGGER IF EXISTS founder_applications_update_timestamp ON founder_applications;
DROP TRIGGER IF EXISTS founders_update_timestamp ON founders;
DROP TRIGGER IF EXISTS founder_pitches_update_timestamp ON founder_pitches;
DROP TRIGGER IF EXISTS judge_scores_update_timestamp ON judge_scores;
DROP TRIGGER IF EXISTS mentor_matches_update_timestamp ON mentor_matches;
DROP TRIGGER IF EXISTS subscriptions_update_timestamp ON subscriptions;
DROP TRIGGER IF EXISTS outbox_jobs_update_timestamp ON outbox_jobs;
DROP TRIGGER IF EXISTS sponsors_update_timestamp ON sponsors;

DROP FUNCTION IF EXISTS update_timestamp();
DROP FUNCTION IF EXISTS has_role(UUID, user_role, role_scope, UUID);
DROP FUNCTION IF EXISTS auth.current_user_id();

-- ============================================================================
-- Drop tables in reverse dependency order
-- ============================================================================

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS outbox_jobs;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS digital_products;
DROP TABLE IF EXISTS mentor_matches;
DROP TABLE IF EXISTS audience_responses;
DROP TABLE IF EXISTS audience_sessions;
DROP TABLE IF EXISTS judge_scores;
DROP TABLE IF EXISTS founder_pitches;
DROP TABLE IF EXISTS founders;
DROP TABLE IF EXISTS founder_applications;
DROP TABLE IF EXISTS rubric_versions;
DROP TABLE IF EXISTS rubric_templates;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS role_assignments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sponsors;

-- ============================================================================
-- Drop enums
-- ============================================================================

DROP TYPE IF EXISTS subscription_status;
DROP TYPE IF EXISTS outbox_job_state;
DROP TYPE IF EXISTS founder_application_status;
DROP TYPE IF EXISTS event_status;
DROP TYPE IF EXISTS role_scope;
DROP TYPE IF EXISTS user_role;
