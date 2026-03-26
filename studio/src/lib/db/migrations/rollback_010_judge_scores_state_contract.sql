-- Rollback for 010_judge_scores_state_contract.sql
-- Restores legacy judge_scores shape used before issue #130.

BEGIN;

ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE judge_scores
SET comment = comments
WHERE comment IS NULL
  AND comments IS NOT NULL;

UPDATE judge_scores
SET is_submitted = state IN ('submitted', 'locked');

DROP POLICY IF EXISTS judge_scores_select_judge_own ON judge_scores;
DROP POLICY IF EXISTS judge_scores_select_admin_all ON judge_scores;
DROP POLICY IF EXISTS judge_scores_insert_judge_own ON judge_scores;
DROP POLICY IF EXISTS judge_scores_update_judge_draft_only ON judge_scores;

ALTER TABLE judge_scores
  DROP CONSTRAINT IF EXISTS judge_scores_state_check;

DROP INDEX IF EXISTS judge_scores_state_idx;

ALTER TABLE judge_scores
  DROP COLUMN IF EXISTS comments,
  DROP COLUMN IF EXISTS total_score,
  DROP COLUMN IF EXISTS category_scores,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS locked_at;

COMMIT;
