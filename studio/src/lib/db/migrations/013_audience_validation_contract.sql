-- Audience validation schema + policy contract alignment for issue #160.
-- Preserves existing data while shifting to one response payload per
-- (audience_session_id, founder_pitch_id).

ALTER TABLE audience_sessions
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE audience_sessions
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

ALTER TABLE audience_responses
  ADD COLUMN IF NOT EXISTS responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

WITH aggregated AS (
  SELECT
    audience_session_id,
    founder_pitch_id,
    jsonb_object_agg(question_id, response_value) AS merged_responses,
    MAX(created_at) AS merged_submitted_at
  FROM audience_responses
  GROUP BY audience_session_id, founder_pitch_id
)
UPDATE audience_responses ar
SET
  responses = COALESCE(aggregated.merged_responses, ar.responses, '{}'::jsonb),
  submitted_at = COALESCE(ar.submitted_at, aggregated.merged_submitted_at, ar.created_at, NOW())
FROM aggregated
WHERE ar.audience_session_id = aggregated.audience_session_id
  AND ar.founder_pitch_id = aggregated.founder_pitch_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY audience_session_id, founder_pitch_id
      ORDER BY created_at ASC, id ASC
    ) AS row_num
  FROM audience_responses
)
DELETE FROM audience_responses ar
USING ranked
WHERE ar.id = ranked.id
  AND ranked.row_num > 1;

ALTER TABLE audience_responses
  DROP CONSTRAINT IF EXISTS audience_responses_audience_session_id_founder_pitch_id_question_id_key;

ALTER TABLE audience_responses
  DROP CONSTRAINT IF EXISTS audience_responses_audience_session_id_founder_pitch_id_key;

ALTER TABLE audience_responses
  ADD CONSTRAINT audience_responses_audience_session_id_founder_pitch_id_key
  UNIQUE(audience_session_id, founder_pitch_id);

ALTER TABLE audience_responses
  ALTER COLUMN submitted_at SET DEFAULT NOW();

ALTER TABLE audience_responses
  DROP COLUMN IF EXISTS question_id,
  DROP COLUMN IF EXISTS response_value;

CREATE INDEX IF NOT EXISTS audience_sessions_expires_at_idx ON audience_sessions(expires_at);
CREATE INDEX IF NOT EXISTS audience_responses_audience_session_id_idx ON audience_responses(audience_session_id);
CREATE INDEX IF NOT EXISTS audience_responses_submitted_at_idx ON audience_responses(submitted_at);

CREATE OR REPLACE FUNCTION current_audience_session_token()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'audience_session_token'),
    ''
  );
$$;

DROP POLICY IF EXISTS audience_sessions_public_insert ON audience_sessions;
DROP POLICY IF EXISTS audience_sessions_admin_all ON audience_sessions;
DROP POLICY IF EXISTS audience_sessions_own ON audience_sessions;
DROP POLICY IF EXISTS "audience_sessions_select_public" ON audience_sessions;
DROP POLICY IF EXISTS "audience_sessions_select_admin" ON audience_sessions;

CREATE POLICY audience_sessions_insert_public ON audience_sessions
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY audience_sessions_select_admin ON audience_sessions
  FOR SELECT
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY audience_sessions_select_own_session ON audience_sessions
  FOR SELECT
  USING (
    session_token <> ''
    AND session_token = current_audience_session_token()
  );

DROP POLICY IF EXISTS audience_responses_public_insert ON audience_responses;
DROP POLICY IF EXISTS audience_responses_admin_all ON audience_responses;
DROP POLICY IF EXISTS audience_responses_founder ON audience_responses;
DROP POLICY IF EXISTS "audience_responses_insert_public" ON audience_responses;
DROP POLICY IF EXISTS "audience_responses_select_founder" ON audience_responses;
DROP POLICY IF EXISTS "audience_responses_select_admin" ON audience_responses;

CREATE POLICY audience_responses_insert_public ON audience_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM audience_sessions s
      WHERE s.id = audience_responses.audience_session_id
        AND s.expires_at > NOW()
    )
  );

CREATE POLICY audience_responses_select_admin ON audience_responses
  FOR SELECT
  USING (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY audience_responses_select_founder ON audience_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM founder_pitches fp
      INNER JOIN founders f ON fp.founder_id = f.id
      WHERE fp.id = audience_responses.founder_pitch_id
        AND f.user_id = auth.current_user_id()
    )
  );

CREATE POLICY audience_responses_select_own_session ON audience_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM audience_sessions s
      WHERE s.id = audience_responses.audience_session_id
        AND s.session_token = current_audience_session_token()
    )
  );
