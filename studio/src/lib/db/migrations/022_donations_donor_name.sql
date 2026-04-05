-- Adds donor_name to donations so the founder donor list and admin donations
-- overview can display the Stripe billing name captured from
-- latest_charge.billing_details.name. Safe to re-run (idempotent).
--
-- Context: migration 021 created the donations table without donor_name.
-- The founder sponsorship PRD requires the donor list to show the Stripe
-- billing name (falling back to "Anonymous"), not the donor email. This
-- migration closes that gap so the webhook handler can persist the name
-- and the UI can render it.

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS donor_name TEXT;
