# Observability Guide

## Overview

The platform uses structured JSON logging, immutable audit logs, basic metrics, and a health check endpoint to provide visibility into operations.

---

## Structured Logging

### Usage

```typescript
import { logger } from '@/lib/logging/logger';

// Log levels: debug, info, warn, error, critical
logger.info('User signed in', { request_id: 'abc123', actor: userId });
logger.error('Payment failed', { request_id, error: err.message, actor: userId });
```

### Log Format

All logs are emitted as newline-delimited JSON to stdout:

```json
{
  "timestamp": "2026-01-01T00:00:00.000Z",
  "level": "info",
  "message": "User signed in",
  "request_id": "abc123",
  "context": {
    "request_id": "abc123",
    "actor": "user-uuid"
  }
}
```

### Log Levels

| Level    | Use Case |
|----------|----------|
| `debug`  | Development only — verbose state |
| `info`   | Normal operations — successful actions |
| `warn`   | Non-fatal issues — degraded state, retries |
| `error`  | Failures that need attention |
| `critical` | System-level failures, data loss risk |

### Minimum Level

Set `LOG_LEVEL` environment variable (defaults to `info` in production, `debug` in development).

### Request ID Propagation

The Next.js middleware (`src/middleware.ts`) generates a `x-request-id` header on every request. Extract it in API handlers:

```typescript
// In an API route handler
const requestId = request.headers.get('x-request-id') ?? '';
logger.info('Processing request', { request_id: requestId });
```

---

## Audit Logging

Audit logs record immutable, compliance-relevant actions. They are stored in the `audit_logs` database table.

### Usage

```typescript
import { auditLog } from '@/lib/audit/log';

// Assign a role
await auditLog(
  'role_assigned',
  actorUserId,
  {
    resource_type: 'user_roles',
    resource_id: targetUserId,
    changes: { before: { role: null }, after: { role: 'Judge', event_id: eventId } },
  },
  { request_id: requestId }
);
```

### Auditable Actions

| Action | When to Call |
|--------|--------------|
| `role_assigned` | Admin assigns a role to a user |
| `role_revoked` | Admin removes a role from a user |
| `event_status_changed` | Event transitions Upcoming → Live → Archived |
| `score_locked` | Admin locks scores for a pitch |
| `score_published` | Admin publishes scores to founders |
| `founder_approved` | Admin approves a founder application |
| `entitlement_granted` | Subscription or digital product granted |
| `entitlement_revoked` | Subscription or digital product revoked |
| `export_created` | Admin exports a report or founder list |
| `file_uploaded` | File stored in Supabase Storage |
| `file_deleted` | File removed from Supabase Storage |

### Viewing Audit Logs

Query via Supabase dashboard or the admin API (admin-only):

```sql
-- All recent audit logs
SELECT actor_id, action, resource_type, resource_id, changes, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;

-- Logs for a specific resource
SELECT * FROM audit_logs WHERE resource_id = '<uuid>';

-- Role changes
SELECT * FROM audit_logs WHERE action IN ('role_assigned', 'role_revoked');
```

---

## Metrics

Basic in-process counters and histograms. Visible in logs and the `/api/health` response.

```typescript
import { incrementCounter, recordHistogram, Metrics } from '@/lib/metrics/metrics';

// Track API latency
const start = Date.now();
// ... handle request ...
recordHistogram(Metrics.API_LATENCY_MS, Date.now() - start);

// Track failures
incrementCounter(Metrics.AUTH_FAILURES);
incrementCounter(Metrics.JOB_FAILURES);
```

### Available Metric Names

| Metric | Type | Description |
|--------|------|-------------|
| `api_latency_ms` | histogram | API endpoint response time |
| `job_processing_ms` | histogram | Background job duration |
| `job_failures` | counter | Failed job count |
| `auth_failures` | counter | Authentication failure count |
| `jobs_processed` | counter | Successfully processed jobs |
| `jobs_retried` | counter | Retried jobs count |
| `errors_<type>` | counter | Errors grouped by type |

---

## Health Check

**GET /api/health** — Used by Vercel and monitoring systems.

### Response

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "db": { "status": "ok", "latency_ms": 12 },
    "storage": { "status": "ok", "latency_ms": 8 }
  }
}
```

### Status Values

| Status | HTTP | Meaning |
|--------|------|---------|
| `ok` | 200 | All checks pass |
| `degraded` | 200 | Some checks non-critical |
| `error` | 503 | Critical failure |

---

## Error Tracking

Errors are captured via `captureError()` from `@/lib/tracking/errorTracking`. Errors are:
- Tagged with a **severity level** (`low`, `medium`, `high`, `critical`)
- Grouped by **error type** (constructor name or `StringError`)
- Enriched with **request context** (request_id, actor)
- Counted in metrics as `errors_<type>`

### Usage

```typescript
import { captureError } from '@/lib/tracking/errorTracking';

try {
  await riskyOperation();
} catch (err) {
  captureError(err as Error, 'high', { request_id, actor: userId });
}

// String errors
captureError('Webhook signature invalid', 'medium', { request_id });
```

### Severity Levels

| Severity   | Use Case |
|------------|----------|
| `low`      | Non-critical issues, logged as warnings |
| `medium`   | Expected failures needing attention |
| `high`     | Significant errors affecting users |
| `critical` | System-level failures, data loss risk |

### Sentry Integration (Optional)

When `SENTRY_DSN` is set and `@sentry/nextjs` is installed, errors are automatically forwarded to Sentry:

1. Install: `npm install @sentry/nextjs`
2. Set `SENTRY_DSN` environment variable
3. Configure per [Sentry Next.js docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

`captureError()` will forward to Sentry automatically — no code changes required.

### Viewing Captured Errors (Development)

```typescript
import { getCapturedErrors } from '@/lib/tracking/errorTracking';

// Returns all errors captured in the current process
const errors = getCapturedErrors();
```
