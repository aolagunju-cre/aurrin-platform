-- Event lifecycle and sponsor contract alignment for issue #138.
-- Aligns events table field names with lifecycle API/UI contracts and enforces
-- one-way status progression semantics while preserving existing data.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scoring_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scoring_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publishing_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publishing_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE events
SET
  start_date = COALESCE(start_date, starts_at),
  end_date = COALESCE(end_date, ends_at),
  scoring_start = COALESCE(scoring_start, scoring_opens_at),
  scoring_end = COALESCE(scoring_end, scoring_closes_at),
  publishing_start = COALESCE(publishing_start, results_published_at),
  publishing_end = COALESCE(publishing_end, results_published_at)
WHERE
  start_date IS NULL
  OR end_date IS NULL
  OR scoring_start IS NULL
  OR scoring_end IS NULL
  OR publishing_start IS NULL
  OR publishing_end IS NULL;

UPDATE events
SET archived_at = COALESCE(archived_at, updated_at, created_at, NOW())
WHERE status = 'archived'::event_status
  AND archived_at IS NULL;

ALTER TABLE events
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_date_window_check,
  DROP CONSTRAINT IF EXISTS events_scoring_window_check,
  DROP CONSTRAINT IF EXISTS events_publishing_window_check;

ALTER TABLE events
  ADD CONSTRAINT events_date_window_check CHECK (start_date <= end_date),
  ADD CONSTRAINT events_scoring_window_check CHECK (
    scoring_start IS NULL
    OR scoring_end IS NULL
    OR scoring_start <= scoring_end
  ),
  ADD CONSTRAINT events_publishing_window_check CHECK (
    publishing_start IS NULL
    OR publishing_end IS NULL
    OR publishing_start <= publishing_end
  );

CREATE OR REPLACE FUNCTION enforce_event_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE OLD.status
      WHEN 'upcoming'::event_status THEN
        IF NEW.status NOT IN ('upcoming'::event_status, 'live'::event_status) THEN
          RAISE EXCEPTION 'Invalid event status transition from % to %', OLD.status, NEW.status;
        END IF;
      WHEN 'live'::event_status THEN
        IF NEW.status NOT IN ('live'::event_status, 'archived'::event_status) THEN
          RAISE EXCEPTION 'Invalid event status transition from % to %', OLD.status, NEW.status;
        END IF;
      WHEN 'archived'::event_status THEN
        IF NEW.status <> 'archived'::event_status THEN
          RAISE EXCEPTION 'Invalid event status transition from % to %', OLD.status, NEW.status;
        END IF;
    END CASE;
  END IF;

  IF NEW.status = 'archived'::event_status AND OLD.status <> 'archived'::event_status THEN
    NEW.archived_at = COALESCE(NEW.archived_at, NOW());
  ELSIF NEW.status <> 'archived'::event_status THEN
    NEW.archived_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_enforce_status_transition ON events;
CREATE TRIGGER events_enforce_status_transition
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_event_status_transition();

-- Sponsor contract normalization for bronze/silver/gold tiers and event/site-wide scope.
UPDATE sponsors
SET placement_scope = 'site-wide'
WHERE placement_scope IN ('sitewide', 'site_wide', 'global');

UPDATE sponsors
SET placement_scope = 'event'
WHERE placement_scope IS NULL OR placement_scope = '';

UPDATE sponsors
SET tier = LOWER(COALESCE(NULLIF(tier, ''), 'bronze'));

ALTER TABLE sponsors
  DROP CONSTRAINT IF EXISTS sponsors_tier_check,
  DROP CONSTRAINT IF EXISTS sponsors_scope_check,
  DROP CONSTRAINT IF EXISTS sponsors_scope_event_constraint;

ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_tier_check CHECK (tier IN ('bronze', 'silver', 'gold')),
  ADD CONSTRAINT sponsors_scope_check CHECK (placement_scope IN ('event', 'site-wide')),
  ADD CONSTRAINT sponsors_scope_event_constraint CHECK (
    (placement_scope = 'event' AND event_id IS NOT NULL)
    OR (placement_scope = 'site-wide' AND event_id IS NULL)
  );
