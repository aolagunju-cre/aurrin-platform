-- Align founder_applications with intake contract fields used by issue #35.
-- Existing rows remain valid; legacy `name` and `application_data` are preserved.

ALTER TABLE founder_applications
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS pitch_summary TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS deck_file_id UUID REFERENCES files(id),
  ADD COLUMN IF NOT EXISTS deck_path TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS twitter TEXT,
  ADD COLUMN IF NOT EXISTS linkedin TEXT,
  ADD COLUMN IF NOT EXISTS assigned_event_id UUID REFERENCES events(id);

UPDATE founder_applications
SET full_name = COALESCE(full_name, name)
WHERE full_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_founder_applications_assigned_event_id
  ON founder_applications(assigned_event_id);
