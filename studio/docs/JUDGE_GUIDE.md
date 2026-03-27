# Judge Guide

This guide explains the current judge scoring workflow in the app.

## How to score a founder pitch

1. Open `/judge/events` to see your assigned events.
2. Select **View Founder Pitches** for a `Live` event or a recent event.
3. On the founder pitch list (`/judge/events/[eventId]`), select **Score Pitch**.
4. On the pitch scoring page (`/judge/events/[eventId]/pitch/[pitchId]`), review the founder details and complete the scoring form.
5. Add optional **Global Comments** for overall feedback.
6. Use **Save Draft** to keep work in progress.
7. Use **Submit Score** when your responses are final for judge submission.

## Rubric explanation (categories, weights, scales)

The scoring form is rendered dynamically from the event rubric version. It does not use hardcoded questions.

- Categories: each category can have its own weight contribution to the final result.
- Questions: categories include required and optional questions.
- Supported response scales and input types:
  - `radio` scale selections (for example 1-5 style rubric ratings)
  - `numeric` values (0-100)
  - `selection` options
  - `text` responses
- Score math:
  - Responses are normalized to numeric values.
  - Category scores are calculated from their question responses.
  - Category weights are applied to produce weighted category values.
  - The UI shows a running total and per-category weighted breakdown in **Current Score Summary**.

## How to submit scores

- **Save Draft** stores your current responses with `state: draft`.
- **Submit Score** sends your final submission with `state: submitted`.
- Required rubric questions must be completed before submit.
- After successful submit, the score is treated as final in the judge UI.

## Score lock and publish process (admin action)

Judges submit scores, but lock and publish are admin-controlled workflow steps.

- `draft`: editable by the assigned judge.
- `submitted`: judge has finalized submission; the UI becomes read-only.
- `locked`: admin lock has been applied and edits are blocked.

The pitch page revision timeline shows `Created`, `Last Draft`, `Submitted`, and `Locked` timestamps when available.

## What happens after publishing

Publishing is an admin action after scoring is complete.

- Founders can view published results only after the publish step.
- Published data is visible through founder-facing experiences and reporting flows.
- Judges do not unlock or publish scores from judge pages.

## Troubleshooting

### Validation errors when submitting

- If submit does not proceed, complete all required rubric questions first.
- Keep comments concise and relevant to the pitch.

### Conflict during save or submit

If you see `This score was updated elsewhere`, the score changed in another session.

1. The page reloads score data.
2. Re-check responses and comments.
3. Retry save or submit.

### Read-only score behavior

- If a score is `submitted` or `locked`, editing controls are disabled by design.
- Contact an admin if you believe lock/publish state changed unexpectedly.
