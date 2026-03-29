# Background Job Infrastructure

The Aurrin platform uses the **outbox pattern** to ensure all side effects (emails,
PDFs, social assets, mentor matching, Stripe webhooks) are durable, retryable, and
never executed inline during HTTP request handling.

## Architecture

```
Request Handler
    │
    └── enqueueJob(type, payload) ──▶ outbox_jobs table (state=pending)
                                             │
                                    Vercel Cron (every 5 min)
                                             │
                                    GET /api/cron/jobs
                                             │
                                    processPendingJobs()
                                             │
                               ┌─────────────┴──────────────┐
                          dispatch to handler           update state
                               │                             │
                          handler returns              completed / failed / dead_letter
                          success | failure
```

## Job States

| State | Description |
|-------|-------------|
| `pending` | Waiting to be picked up |
| `processing` | Currently being executed |
| `completed` | Successfully processed |
| `failed` | Failed but will be retried |
| `dead_letter` | Max retries exceeded — needs manual review |

## How to Enqueue a Job

```typescript
import { enqueueJob } from '@/lib/jobs/enqueue';

// Fire-and-forget: enqueue an email
await enqueueJob('send_email', {
  to: 'founder@example.com',
  template_name: 'welcome_founder',
  data: { name: 'Jane' },
});

// Enqueue with aggregate reference (for idempotency tracking)
await enqueueJob('mentor_match', {
  event_id: 'evt-123',
  founder_id: 'usr-456',
}, {
  aggregate_id: 'evt-123',
  aggregate_type: 'event',
});

// Schedule for later
await enqueueJob('pdf_generate', {
  event_id: 'evt-123',
  founder_id: 'usr-456',
  template: 'validation_report',
}, {
  scheduled_at: new Date(Date.now() + 60_000).toISOString(), // 1 minute from now
});
```

## How to Add a New Job Type

1. **Add the type** to `JobType` in `studio/src/lib/jobs/types.ts`:
   ```typescript
   export type JobType = 'email' | 'pdf_generate' | ... | 'your_new_type';
   ```

2. **Create a handler** at `studio/src/lib/jobs/handlers/your-type.ts`:
   ```typescript
   import type { JobResult } from '../types';

   export async function handleYourTypeJob(payload: Record<string, unknown>): Promise<JobResult> {
     // validate payload, do the work
     return { success: true };
   }
   ```

3. **Register the handler** in `studio/src/lib/jobs/processor.ts`:
   ```typescript
   import { handleYourTypeJob } from './handlers/your-type';

   // Add a case to dispatchJob():
   case 'your_new_type':
     return handleYourTypeJob(job.payload);
   ```

4. **Write tests** in `studio/test/jobs.test.ts`.

## Retry & Backoff Strategy

Jobs that fail are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1st retry | 60 seconds |
| 2nd retry | 5 minutes |
| 3rd retry | 15 minutes |
| 4th retry | 30 minutes |
| 5th retry | 1 hour |

The default `max_retries` is **3** (matches schema default). After 3 failures the job
is moved to `dead_letter` state.

To configure per-job retries:
```typescript
await enqueueJob('webhook', payload, { max_retries: 5 });
```

## How to Handle Failures

**Dead-letter jobs** require manual review:

1. Query dead jobs in Supabase Studio:
   ```sql
   SELECT * FROM outbox_jobs WHERE state = 'dead_letter' ORDER BY updated_at DESC;
   ```

2. Inspect `last_error` / `error_message` to understand the failure.

3. To replay a dead job, reset its state:
   ```sql
   UPDATE outbox_jobs
   SET state = 'pending', retry_count = 0, last_error = NULL, scheduled_at = NULL
   WHERE id = '<job-id>';
   ```

## Cron Invocation

The worker runs via Vercel Cron every 5 minutes (configured in `studio/vercel.json`):

```json
{
  "crons": [{ "path": "/api/cron/jobs", "schedule": "*/5 * * * *" }]
}
```

The route is protected by `CRON_SECRET` environment variable when set. Vercel
automatically injects `Authorization: Bearer <CRON_SECRET>` on cron-invoked requests.

## Observability

Each job lifecycle event is logged to stdout:

- `[jobs/processor] Starting job <id> type=<type> retry=<n>` — job started
- `[jobs/processor] Job <id> completed` — success
- `[jobs/processor] Job <id> failed (attempt N), scheduled for retry` — transient failure
- `[jobs/processor] Job <id> moved to dead_letter after N retries` — permanent failure

Metrics are tracked in the `process_result` returned by `processPendingJobs()`:
`{ processed, succeeded, failed, dead }`.
