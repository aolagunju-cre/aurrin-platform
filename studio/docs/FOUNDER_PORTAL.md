# Founder Portal Guide

This guide documents the implemented founder portal contract in `studio/src/app/(protected)/founder/*`.

## Access and authentication

- Founder pages and APIs require authenticated founder context.
- Founder-scoped APIs enforce ownership: founders can only access their own event, score, validation, and report resources.
- Admin role may use override access paths where route contracts explicitly allow it.

## View scores and validation

Founders can review assigned events at `/founder/events` and open pitch detail at `/founder/events/[eventId]/pitch`.

- Before `publishing_start`, score and validation endpoints are gated and return `403` to founder users.
- On or after `publishing_start`, founders can view:
  - aggregate score and per-category breakdown,
  - per-judge score rows (respecting visibility rules),
  - validation summary with totals, percentages, numeric averages, and text snippets.
- Scoring status messaging is:
  - `Judges are scoring`
  - `Scores will be published on {date}`
  - `Scores published`

## Report generation and download

Founders manage reports at `/founder/reports`.

- Generate: `POST /api/founder/reports/generate` with `{ event_id, pitch_id, report_type: 'full'|'summary' }`
  - Returns `202` with `{ job_id, status_url }`
  - Shows async message: `Your report is being generated. You'll receive an email when ready.`
- Status: `GET /api/founder/reports/[reportId]/status`
  - Maps to UI statuses:
    - `Generating...`
    - `Ready (download)`
    - `Failed (try again)`
- Download: `GET /api/founder/reports/[reportId]/download`
  - Returns a signed URL to the generated PDF when ready.

## Privacy and data retention

- Generated report files are stored in the `generated-reports` bucket.
- Founder report files are private (`is_public: false`) and tied to founder ownership.
- Generated report metadata uses a 7-day retention fallback (`retention_days: 7`).
- Signed URL expiry for report downloads follows report route defaults and fallback policy.

## Notification behavior

- Founders receive score-publish notification email content containing:
  - the exact phrase `Your scores are now available`,
  - a founder-portal call-to-action link,
  - an events summary describing newly available scores.
