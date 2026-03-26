# Aurrin Platform Architecture

This document describes the current system architecture for the Aurrin Ventures platform and aligns it with the source PRD (#28) and split documentation contract (#98).

## Bounded Contexts

The platform is organized around bounded contexts, with thin Next.js route handlers delegating to library modules and database access:

1. Identity and Access
- Authentication (`studio/src/lib/auth/jwt.ts`, `studio/src/lib/auth/session.ts`)
- Authorization guard patterns (`studio/src/lib/auth/admin.ts`, route-level auth checks)
- Role assignments and scope-aware access checks in the database layer

2. Event Operations
- Event lifecycle and assignment flows are represented in schema and admin APIs
- Founder application review and assignment flow implemented in protected admin application route

3. Judging and Rubrics
- Rubric template/version lifecycle APIs (`/api/admin/rubrics`, clone and version update paths)
- Weighted rubric validation and immutable versioning behavior in rubric library and DB

4. Audience Validation
- Public participation/validation domain is currently planned; data model and access boundaries are already present in schema-level docs and migrations

5. Founder Outcomes
- Founder application intake and status transitions
- Founder records linked to accepted applications

6. Commerce and Entitlements
- Commerce entities exist in schema and operational model; full route surface is still planned

7. Notifications and Media
- File upload pipeline (`/api/upload`) for storage-backed artifacts
- Outbox job processing (`/api/cron/jobs`) for asynchronous side effects such as email

8. Ops and Compliance
- Health endpoint (`/api/health`) for service readiness
- Audit hooks used on critical admin actions (rubric create/update/clone)

## Data Flows

### Founder Application Flow
1. Public user submits multipart form at `/api/public/apply`.
2. Route validates payload and deck constraints.
3. Deck is uploaded to storage via shared upload utilities.
4. Founder application is inserted or updated in the database.
5. Welcome email job is queued to outbox for asynchronous processing.

### Admin Rubric Flow
1. Admin calls rubric APIs under `/api/admin/rubrics*`.
2. Route guard enforces admin authorization.
3. Handler validates rubric definition and weight rules.
4. Template and version records are read/written in DB client layer.
5. Audit event is persisted for traceability.

### Background Job Flow
1. Scheduler calls `/api/cron/jobs`.
2. Route verifies cron secret (when configured).
3. Job processor fetches pending outbox jobs and dispatches handlers.
4. Job state transitions are persisted (`pending` -> `processing` -> terminal state).

## API Layer Shape

The API layer follows a thin-handlers pattern:

- Route handlers in `studio/src/app/api/**/route.ts` focus on
  - request parsing
  - auth checks
  - response shaping
- Domain logic and validations live in `studio/src/lib/**`
  - rubric validation utilities
  - auth/session helpers
  - upload/signing helpers
  - job enqueue and processing modules
- Database access is centralized via `studio/src/lib/db/client.ts`

This keeps route handlers small and allows testable domain services.

## ADR Summary (10 Decisions)

1. ADR-001: Supabase selected as managed PostgreSQL platform.
2. ADR-002: Supabase Auth for identity, DB-backed RBAC for authorization.
3. ADR-003: Shared commerce model with phased feature rollout.
4. ADR-004: Versioned rubrics with normalized scoring records.
5. ADR-005: Realtime is a projection; Postgres is source of truth.
6. ADR-006: Audience validation via server-issued sessions, not fingerprinting.
7. ADR-007: Durable outbox and worker pattern for side effects.
8. ADR-008: Email-first notification strategy; SMS deferred.
9. ADR-009: Explicit state transitions, optimistic/idempotent operations, auditability.
10. ADR-010: Reports/assets generated asynchronously and served from storage.

## Scalability

- Web tier: Next.js on Vercel with horizontal auto-scale behavior.
- Data tier: Supabase/PostgreSQL as system of record.
- Future-read scaling: Supabase read replicas are a planned option for read-heavy workloads.
- Async workload scaling: outbox/worker pattern decouples heavy tasks from request latency.

## Reliability Patterns

- retry: outbox jobs are processed with retry-oriented state transitions.
- idempotency: handlers are designed around replay-safe status transitions and duplicate-safe updates.
- audit: admin-critical changes (e.g., rubric mutations) write audit records for traceability.
- explicit lifecycle states on key domains (applications, jobs, scoring flows) reduce ambiguity under failure.

## Current vs Planned Surface

Implemented now:
- Health checks
- Public founder apply intake
- Protected founder application status transitions
- Admin rubric management API
- Upload API and background jobs cron trigger

Planned and documented for upcoming phases:
- Full judge domain APIs
- Mentor and subscriber domain APIs
- Expanded founder portal/public outcomes APIs
