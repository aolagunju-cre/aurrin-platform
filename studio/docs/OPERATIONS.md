# Operations Runbook

This runbook is for admins/operators managing live events and platform reliability.

## Common Tasks

### add event

1. Create event metadata in admin flows.
2. Set schedule windows (start/end, scoring open/close).
3. Confirm rubric version and assignments.

### approve founder

1. Review founder application details.
2. Mark decision in admin workflow.
3. Confirm founder record creation and notification job enqueue.

### lock scores

1. Verify all expected judge submissions are complete.
2. Execute score lock operation.
3. Confirm audit log entry and that edits are blocked.

### publish results

1. Confirm lock state is final.
2. Publish founder-facing score summaries.
3. Validate founder portal visibility and notification delivery state.

## Troubleshooting

- Check `GET /api/health` first.
- Inspect structured logs with request/job identifiers.
- Inspect `outbox_jobs` state (`pending`, `failed`, `dead_letter`).
- Validate audit logs for admin actions.

### scoring delay

1. Inspect worker schedule and `outbox_jobs` backlog.
2. Retry failed jobs after root-cause fix.
3. If lock/publish happened early, coordinate admin correction plan.

### payment failures

1. Inspect recent Stripe webhook processing and `transactions` entries.
2. Validate idempotency keys and duplicate-event handling.
3. Reprocess failed webhook jobs when safe.

### email delivery failures

1. Inspect email job errors in `outbox_jobs.error_message`.
2. Confirm provider credentials and sender configuration.
3. Replay failed jobs after config correction.

## Incident Response

1. Classify incident severity and impacted scope.
2. Capture timeline and affected entities.
3. Mitigate (pause risky writes, disable problematic cron path, or rollback deploy).
4. Validate system health and close with postmortem actions.

## Backups and Recovery

### restore

1. Identify target recovery point and impacted data domains.
2. Run restore in staging first.
3. Validate key contracts (events, scores, subscriptions, files metadata).
4. Execute production restore only after validation.
5. Record recovery actions in incident notes.

### restore-drill expectations

- Run at least monthly.
- Measure achieved RPO/RTO.
- Record gaps and remediation owner.

## KPI / Dashboard Checklist

- API health and latency
- job throughput and dead-letter count
- auth failure rate
- event scoring completion rate
- payment success/failure ratio
- email send success/failure ratio
