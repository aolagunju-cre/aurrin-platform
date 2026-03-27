# Mentor Matching Guide

This guide documents the implemented mentor matching workflow for operators and support responders.

## Workflow Summary

1. Admin triggers random matching for an event with:
   - `POST /api/admin/events/[eventId]/mentors/match`
   - body: `{ "num_mentors_per_founder": number, "exclude_previous_pairs_months": number }`
2. The matcher pairs mentors and founders assigned to the event.
3. Repeat-prevention skips pairs seen within the exclusion window and reports them as `conflicts`.
4. New pairs are created in `mentor_matches` with:
   - `mentor_status: pending`
   - `founder_status: pending`
5. A `mentor_match` job is enqueued for notifications/reminders.

## Matching and Repeat Prevention

- Input pool:
  - mentors assigned to event with mentor role
  - founders assigned to event
- The response contract for random matching is:
  - `{ "matches_created": N, "conflicts": M }`
- Repeat prevention uses a lookback window based on `exclude_previous_pairs_months`.
- If a pair exists inside that window, the pair is skipped and counted in `conflicts`.
- If the pair is outside the window, the pair is eligible again.

## Acceptance Flow

### Mentor decision

- `PATCH /api/mentor/matches/[matchId]`
- body: `{ "action": "accept" | "decline" }`
- response contract:
  - `{ "status": "accepted" | "declined" | "pending", "mutual_acceptance": boolean }`

Behavior:
- `accept` sets mentor status and `mentor_accepted_at`.
- `decline` marks the mentor side as declined and records `declined_by` metadata.
- If both sides are accepted, the flow is in mutual acceptance.

### Founder visibility and gating

- Founders can list accepted matches via `GET /api/founder/matches`.
- Founders can view accepted match detail via `GET /api/founder/matches/[matchId]`.
- Founder match visibility is gated by score publishing window.
- Before `publishing_start`, non-admin founders are denied match visibility.

## Notifications and Intro Emails

The `mentor_match` job orchestrates email behavior:

1. On match creation:
   - Mentor notification: "You've been paired with {founder}! Accept to connect."
   - Founder notification only when publish-window gating allows founder visibility.
2. One-week reminders:
   - Reminder cadence is 7 days from match creation for still-pending responses.
   - Mentor reminder: "Don't forget to respond to your match with {founder}"
   - Founder reminder (publish-gated): "Mentor {name} is waiting for your response"
3. On mutual acceptance:
   - Intro email sent to both parties
   - Subject/copy semantics: "Mentor X, meet Founder Y"

## Manual Override Operations

Admins can manually manage pairings when needed:

- Create: `POST /api/admin/events/[eventId]/mentors/matches`
- Delete: `DELETE /api/admin/events/[eventId]/mentors/matches/[matchId]`

Use manual creation when random matching did not produce the desired coverage.

## Troubleshooting

### Auth failure (`401`/`403`)

- Confirm bearer token is present and valid.
- Confirm caller has the required role:
  - admin for admin matching endpoints
  - mentor for mentor decision endpoint
  - founder or admin for founder visibility endpoints
- Confirm role assignment scope includes the event.

### Founder cannot see expected match

- Verify match has mutual acceptance (`mentor_status=accepted` and `founder_status=accepted`).
- Verify event `publishing_start` has passed for non-admin founder access.
- Verify founder ownership and event-scope authorization.

### Missing intro email job

- Verify mutual acceptance state is reached.
- Confirm `mentor_match` jobs are being enqueued and processed.
- Check outbox job state transitions for failed/dead-letter entries.
- Verify expected template names are available:
  - `mentor_match_created`
  - `founder_match_created`
  - `match_accepted`
  - `match_reminder`

### Unexpected conflict counts

- Re-check the configured `exclude_previous_pairs_months` input.
- Inspect prior mentor/founder pairs and `created_at` timestamps.
- Run a second matching pass after the lookback window to verify eligibility returns.
