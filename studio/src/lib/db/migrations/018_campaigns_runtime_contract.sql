-- Runtime safety follow-ups for campaign crowdfunding.
-- Keeps 016 as the table baseline while hardening public access and donation updates.

DROP POLICY IF EXISTS donations_public_read ON campaign_donations;

CREATE OR REPLACE FUNCTION increment_campaign_raised(
  campaign_id_input UUID,
  amount_input INTEGER
)
RETURNS campaigns
LANGUAGE plpgsql
AS $$
DECLARE
  updated_campaign campaigns%ROWTYPE;
BEGIN
  IF amount_input IS NULL OR amount_input <= 0 THEN
    RAISE EXCEPTION 'amount_input must be a positive integer';
  END IF;

  UPDATE campaigns
  SET
    amount_raised_cents = amount_raised_cents + amount_input,
    donor_count = donor_count + 1,
    status = CASE
      WHEN funding_goal_cents > 0 AND amount_raised_cents + amount_input >= funding_goal_cents
        THEN 'funded'::campaign_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = campaign_id_input
    AND status IN ('active', 'funded')
  RETURNING * INTO updated_campaign;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found or not accepting donations';
  END IF;

  RETURN updated_campaign;
END;
$$;
