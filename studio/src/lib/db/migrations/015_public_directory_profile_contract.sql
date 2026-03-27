-- Public directory data contract alignment for issue #203.
-- Adds founder directory visibility controls, stable public profile slugs,
-- and public/read authorization boundaries for directory exposure.

ALTER TABLE founder_pitches
  ADD COLUMN IF NOT EXISTS visible_in_directory BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_profile_slug TEXT;

CREATE OR REPLACE FUNCTION normalize_public_profile_slug(source_text TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := LOWER(REGEXP_REPLACE(COALESCE(source_text, ''), '[^a-z0-9]+', '-', 'g'));
  normalized := REGEXP_REPLACE(normalized, '(^-+|-+$)', '', 'g');

  IF normalized = '' THEN
    normalized := 'founder';
  END IF;

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION next_founder_profile_slug(source_text TEXT, current_pitch_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT := normalize_public_profile_slug(source_text);
  candidate_slug TEXT := base_slug;
  suffix INT := 0;
BEGIN
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM founder_pitches fp
      WHERE fp.public_profile_slug = candidate_slug
        AND (current_pitch_id IS NULL OR fp.id <> current_pitch_id)
    );

    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::TEXT;
  END LOOP;

  RETURN candidate_slug;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION founder_pitches_assign_public_slug()
RETURNS TRIGGER AS $$
DECLARE
  company_name_value TEXT;
BEGIN
  IF NEW.public_profile_slug IS NULL OR BTRIM(NEW.public_profile_slug) = '' THEN
    SELECT f.company_name
    INTO company_name_value
    FROM founders f
    WHERE f.id = NEW.founder_id;

    NEW.public_profile_slug := next_founder_profile_slug(company_name_value, NEW.id);
  ELSE
    NEW.public_profile_slug := next_founder_profile_slug(NEW.public_profile_slug, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS founder_pitches_assign_public_slug ON founder_pitches;
CREATE TRIGGER founder_pitches_assign_public_slug
  BEFORE INSERT OR UPDATE OF founder_id, public_profile_slug ON founder_pitches
  FOR EACH ROW
  EXECUTE FUNCTION founder_pitches_assign_public_slug();

UPDATE founder_pitches fp
SET public_profile_slug = next_founder_profile_slug(f.company_name, fp.id)
FROM founders f
WHERE fp.founder_id = f.id
  AND (fp.public_profile_slug IS NULL OR BTRIM(fp.public_profile_slug) = '');

CREATE UNIQUE INDEX IF NOT EXISTS founder_pitches_public_profile_slug_unique_idx
  ON founder_pitches(public_profile_slug)
  WHERE public_profile_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS founder_pitches_visible_in_directory_idx
  ON founder_pitches(visible_in_directory);

CREATE OR REPLACE FUNCTION enforce_founder_directory_visibility_gate()
RETURNS TRIGGER AS $$
DECLARE
  event_status_value event_status;
BEGIN
  IF NEW.visible_in_directory = TRUE THEN
    IF NEW.is_published IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Founder pitch must be published before directory visibility can be enabled';
    END IF;

    SELECT e.status
    INTO event_status_value
    FROM events e
    WHERE e.id = NEW.event_id;

    IF event_status_value IS DISTINCT FROM 'archived'::event_status THEN
      RAISE EXCEPTION 'Directory visibility can only be enabled after event completion';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS founder_pitches_enforce_directory_visibility_gate ON founder_pitches;
CREATE TRIGGER founder_pitches_enforce_directory_visibility_gate
  BEFORE INSERT OR UPDATE OF visible_in_directory, is_published, event_id ON founder_pitches
  FOR EACH ROW
  EXECUTE FUNCTION enforce_founder_directory_visibility_gate();

DROP POLICY IF EXISTS founder_pitches_published ON founder_pitches;
CREATE POLICY founder_pitches_published ON founder_pitches FOR SELECT
  USING (
    is_published = TRUE
    AND visible_in_directory = TRUE
    AND EXISTS (
      SELECT 1
      FROM events e
      WHERE e.id = founder_pitches.event_id
        AND e.status = 'archived'::event_status
    )
  );
