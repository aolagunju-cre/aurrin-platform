# Event Lifecycle

This guide defines the event lifecycle contract used by admin APIs and role-based event views.

## Event Status Flow

Event status uses explicit one-way states:

- `Upcoming`
- `Live`
- `Archived`

Allowed admin transitions:

- `Upcoming -> Live`
- `Live -> Archived`

Disallowed transitions:

- `Archived -> Live`
- Any transition back to `Upcoming`

Lifecycle route:

- `PATCH /api/admin/events/[eventId]/status`
- Body: `{ "new_status": "Live" | "Archived", "notes"?: string }`

Status transitions are audited via `event_status_changed`. Repeated requests for a current valid status are idempotent and return success without additional mutation.

## Scoring And Publishing Windows

Scoring window controls when judges can submit or edit scores:

- `scoring_start`
- `scoring_end`

Publishing window controls when founders can see score outcomes:

- `publishing_start`
- `publishing_end`

Window update routes:

- `PATCH /api/admin/events/[eventId]/scoring-window`
- `PATCH /api/admin/events/[eventId]/publishing-window`

Scoring window updates are audited via `scoring_window_updated`. Publishing window updates are audited via `publishing_window_updated`.

Judge scoring APIs enforce window boundaries. Submissions outside the scoring window return HTTP `400`.

## Judge And Founder Interaction Timing

Judge experience:

- Judges see assigned events.
- While scoring window is open, judge views show `Scoring open until {end_date}`.
- Outside the scoring window, judge views show `Scoring closed`, and score mutation APIs reject updates.

Founder experience:

- Founders see assigned events.
- During scoring, founders see `Judges are scoring`.
- After scoring closes and before publishing starts, founders see `Scoring closed, results pending`.
- Before publishing starts, score data is withheld and founders see `Scores will be published on {date}`.
- After publishing starts, founders can view aggregate and breakdown score data.

## Admin Transition Controls

Admin event detail page controls:

- Status action labels: `Go Live` and `Archive`
- Confirmation modal text before status change: `Are you sure?`

Admin route controls:

- `PATCH /api/admin/events/[eventId]/status` enforces lifecycle rules and idempotency.
- `PATCH /api/admin/events/[eventId]/scoring-window` validates window range and event-date boundaries.
- `PATCH /api/admin/events/[eventId]/publishing-window` validates publishing window range.

All lifecycle mutations are designed for explicit operations and immutable audit trails.
