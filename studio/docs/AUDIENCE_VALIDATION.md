# Audience Validation Runbook

This guide covers public audience validation for live events, including the QR entry flow, operator configuration, privacy/consent handling, and aggregate reporting.

## How QR Codes Work

- QR codes should point to the public entry route: `/public/validate/{eventId}`.
- The entry page starts validation by calling `POST /api/public/validate/[eventId]/session`.
- On success (`201`), the response is:
  - `session_id`
  - `event_id`
  - `created_at`
- The client then navigates to `/public/validate/{eventId}/session/{sessionId}`.

## Question Configuration

- Validation questions are configured at the event level and stored in event config.
- Supported question types in the public validation UI:
  - rating (numeric)
  - yes/no
  - free-text
- Session details and questions are loaded via `GET /api/public/validate/[eventId]/session/[sessionId]`.
- The session payload includes:
  - session metadata (`id`, `event_id`, `created_at`, `expires_at`)
  - event metadata (`id`, `name`, `start_date`, `end_date`)
  - `questions`
  - `founder_pitches`

## Data Privacy and Consent

- Public validation is intentionally unauthenticated and is scoped to event/session contracts.
- Session creation accepts optional contact details and consent flags.
- Session creation route: `POST /api/public/validate/[eventId]/session`
  - Optional request fields: `email`, `consent_given`, `contact_opt_in`
- Expired sessions are blocked:
  - `GET /api/public/validate/[eventId]/session/[sessionId]` returns `403` for expired sessions.
  - `POST /api/public/validate/[eventId]/session/[sessionId]/response` returns `403` for expired sessions.

## Aggregation and Reporting

- Audience response submission route:
  - `POST /api/public/validate/[eventId]/session/[sessionId]/response`
  - Request body: `{ founder_pitch_id, responses }`
- Duplicate protection is enforced for the same founder/session path.
  - Duplicate submission returns `409` with exact message:
  - `You've already submitted feedback for this founder`
- Validation summary route:
  - `GET /api/public/events/[eventId]/pitches/[pitchId]/validation-summary`
- Summary response contract includes:
  - `total_responses`
  - `aggregate_score`
  - `breakdown_by_question`
  - `preview_mode`

### Visibility Rules

- Admin users can view live aggregate data.
- Founders can view live aggregate data only after publishing start.
- Founders before publishing start can use `?preview=true` to receive a non-live placeholder summary shape.
