-- Mentor matching contract alignment for issue #182.
-- Adds PRD-required status fields and admin-safe policies without removing
-- legacy columns used by existing code paths.

ALTER TABLE mentor_matches
  ADD COLUMN IF NOT EXISTS mentor_status TEXT,
  ADD COLUMN IF NOT EXISTS founder_status TEXT,
  ADD COLUMN IF NOT EXISTS declined_by TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE mentor_matches
SET
  mentor_status = COALESCE(
    mentor_status,
    CASE
      WHEN status IN ('pending_mentor', 'pending_founder') THEN 'pending'
      WHEN status IN ('accepted', 'declined') THEN status
      ELSE 'pending'
    END
  ),
  founder_status = COALESCE(
    founder_status,
    CASE
      WHEN status = 'declined' THEN 'declined'
      WHEN status = 'accepted' THEN 'accepted'
      ELSE 'pending'
    END
  )
WHERE mentor_status IS NULL
  OR founder_status IS NULL;

ALTER TABLE mentor_matches
  ALTER COLUMN mentor_status SET DEFAULT 'pending',
  ALTER COLUMN founder_status SET DEFAULT 'pending',
  ALTER COLUMN mentor_status SET NOT NULL,
  ALTER COLUMN founder_status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE mentor_matches
  DROP CONSTRAINT IF EXISTS mentor_matches_mentor_status_check,
  DROP CONSTRAINT IF EXISTS mentor_matches_founder_status_check;

ALTER TABLE mentor_matches
  ADD CONSTRAINT mentor_matches_mentor_status_check CHECK (mentor_status IN ('pending', 'accepted', 'declined')),
  ADD CONSTRAINT mentor_matches_founder_status_check CHECK (founder_status IN ('pending', 'accepted', 'declined'));

CREATE INDEX IF NOT EXISTS mentor_matches_event_id_idx ON mentor_matches(event_id);
CREATE INDEX IF NOT EXISTS mentor_matches_mentor_status_idx ON mentor_matches(mentor_status);
CREATE INDEX IF NOT EXISTS mentor_matches_founder_status_idx ON mentor_matches(founder_status);
CREATE INDEX IF NOT EXISTS mentor_matches_created_at_idx ON mentor_matches(created_at DESC);

DROP POLICY IF EXISTS mentor_matches_admin_all ON mentor_matches;
DROP POLICY IF EXISTS mentor_matches_mentor ON mentor_matches;
DROP POLICY IF EXISTS mentor_matches_founder ON mentor_matches;
DROP POLICY IF EXISTS "mentor_matches_select_own" ON mentor_matches;
DROP POLICY IF EXISTS "mentor_matches_select_admin" ON mentor_matches;
DROP POLICY IF EXISTS "mentor_matches_insert_admin" ON mentor_matches;
DROP POLICY IF EXISTS "mentor_matches_update_own" ON mentor_matches;

CREATE POLICY mentor_matches_admin_all ON mentor_matches
  FOR ALL
  USING (has_role(auth.current_user_id(), 'admin'::user_role))
  WITH CHECK (has_role(auth.current_user_id(), 'admin'::user_role));

CREATE POLICY mentor_matches_select_mentor_own ON mentor_matches
  FOR SELECT
  USING (mentor_id = auth.current_user_id());

CREATE POLICY mentor_matches_select_founder_published_only ON mentor_matches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM founders f
      INNER JOIN founder_pitches fp
        ON fp.founder_id = f.id
       AND fp.event_id = mentor_matches.event_id
      WHERE f.id = mentor_matches.founder_id
        AND f.user_id = auth.current_user_id()
        AND fp.is_published = TRUE
    )
  );
