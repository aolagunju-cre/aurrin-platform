-- Add unsubscribe state required by issue #93.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID;

UPDATE users
SET unsubscribe_token = gen_random_uuid()
WHERE unsubscribe_token IS NULL;

ALTER TABLE users
  ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_unsubscribe_token_key ON users(unsubscribe_token);

COMMENT ON COLUMN users.unsubscribed IS 'When true, suppresses non-transactional email enqueueing for this user.';
COMMENT ON COLUMN users.unsubscribe_token IS 'Per-user token used by POST /api/unsubscribe verification.';
