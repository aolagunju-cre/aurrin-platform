-- Judge score contract alignment for issue #130.
-- Normalizes judge_scores to explicit state semantics and draft-only judge updates.

BEGIN;

ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS total_score NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Preserve legacy data shape where it exists.
UPDATE judge_scores
SET comments = comment
WHERE comments IS NULL
  AND comment IS NOT NULL;

UPDATE judge_scores
SET state = CASE
  WHEN state IN ('draft', 'submitted', 'locked') THEN state
  WHEN is_submitted IS TRUE THEN 'submitted'
  ELSE 'draft'
END;

UPDATE judge_scores
SET submitted_at = COALESCE(submitted_at, updated_at, created_at)
WHERE state IN ('submitted', 'locked')
  AND submitted_at IS NULL;

UPDATE judge_scores
SET locked_at = COALESCE(locked_at, updated_at, created_at)
WHERE state = 'locked'
  AND locked_at IS NULL;

ALTER TABLE judge_scores
  DROP CONSTRAINT IF EXISTS judge_scores_state_check;

ALTER TABLE judge_scores
  ADD CONSTRAINT judge_scores_state_check
  CHECK (state IN ('draft', 'submitted', 'locked'));

ALTER TABLE judge_scores
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS judge_scores_state_idx ON judge_scores(state);

-- Remove legacy fields that are superseded by explicit state.
ALTER TABLE judge_scores
  DROP COLUMN IF EXISTS comment,
  DROP COLUMN IF EXISTS is_submitted;

-- Rebuild policies to align with draft-only judge edits.
DROP POLICY IF EXISTS "judge_scores_select_own" ON judge_scores;
DROP POLICY IF EXISTS "judge_scores_select_admin" ON judge_scores;
DROP POLICY IF EXISTS "judge_scores_select_founder_published" ON judge_scores;
DROP POLICY IF EXISTS "judge_scores_insert_judge" ON judge_scores;
DROP POLICY IF EXISTS "judge_scores_update_judge" ON judge_scores;
DROP POLICY IF EXISTS judge_scores_admin_all ON judge_scores;
DROP POLICY IF EXISTS judge_scores_own ON judge_scores;
DROP POLICY IF EXISTS judge_scores_founder ON judge_scores;

CREATE POLICY judge_scores_select_judge_own ON judge_scores
  FOR SELECT
  USING (judge_id = auth.uid());

CREATE POLICY judge_scores_select_admin_all ON judge_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM role_assignments ra
      WHERE ra.user_id = auth.uid()
        AND ra.role = 'admin'
        AND ra.scope = 'global'
    )
  );

CREATE POLICY judge_scores_insert_judge_own ON judge_scores
  FOR INSERT
  WITH CHECK (judge_id = auth.uid() AND state = 'draft');

CREATE POLICY judge_scores_update_judge_draft_only ON judge_scores
  FOR UPDATE
  USING (judge_id = auth.uid() AND state = 'draft')
  WITH CHECK (judge_id = auth.uid() AND state IN ('draft', 'submitted', 'locked'));

COMMIT;
