-- Outbox contract extension for PRD email workflow:
-- - send_email job type payloads are tracked in outbox_jobs
-- - delivery metadata is persisted on the outbox row

ALTER TABLE outbox_jobs
  ADD COLUMN IF NOT EXISTS email_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN outbox_jobs.email_id IS 'Provider message identifier recorded on successful send_email completion.';
COMMENT ON COLUMN outbox_jobs.error_message IS 'Provider/application error recorded for send_email failures and retries.';
