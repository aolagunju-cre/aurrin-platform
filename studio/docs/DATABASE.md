# Database Schema - Aurrin Ventures Event & Validation Platform

## Overview

This document describes the PostgreSQL schema for the Aurrin Ventures platform, hosted on Supabase. The schema implements all 15+ core entities defined in the PRD, with support for role-based access control, audit logging, and durable background jobs.

**Tech Stack**: PostgreSQL via Supabase (managed service)  
**Architecture Pattern**: Domain-driven design with RLS-enforced authorization  
**Key Principles**:
- Supabase Auth for identity; database-backed RBAC for authorization
- Row-Level Security (RLS) enforces access control at the database layer
- Audit tables track all sensitive operations (approvals, role changes, scoring locks)
- Outbox pattern enables durable async workflows (emails, PDFs, webhooks)
- Versioned rubrics ensure scoring is always against the same schema
- Point-in-time recovery enabled for operational resilience

---

## Quick Start

### 1. Create Supabase Project
Visit https://supabase.com and create a new PostgreSQL project.

### 2. Configure Environment
```bash
cd studio
cp .env.example .env.local
# Edit .env.local with your Supabase credentials:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 3. Apply Migrations
```bash
# Via Supabase CLI
npx supabase db push

# Or manually: copy 001_initial_schema.sql and 002_rls_policies.sql into Supabase SQL Editor
```

### 4. Enable Point-in-Time Recovery
In Supabase dashboard: Project Settings → Backup → Enable PITR (7 day retention recommended)

### 5. Test
```bash
npm test
```

---

## Entity Reference (15+ Entities)

### Identity & Access
- **users** — Authentication profiles
- **role_assignments** — Authorization mapping with scopes

### Event Operations
- **events** — Pitch events (Upcoming → Live → Archived)
- **sponsors** — Event and site-wide sponsors

### Rubrics & Scoring
- **rubric_templates** — Reusable scoring structures
- **rubric_versions** — Immutable versions published at go-live
- **judge_scores** — Per-judge, per-founder, per-event scoring

### Founder Management
- **founder_applications** — Application submissions (Pending → Accepted → Assigned → Declined)
- **founders** — Founder profiles (created on acceptance)
- **founder_pitches** — Founder pitches at specific events

### Audience Validation
- **audience_sessions** — Server-issued QR tokens (24-hour TTL)
- **audience_responses** — Validation feedback (one per question, dedup enforced)

### Mentor Matching
- **mentor_matches** — Random pairings with repeat prevention

### Commerce
- **digital_products** — One-time purchase items
- **subscriptions** — Stripe-managed recurring billing
- **orders** — Purchase records
- **transactions** — Append-only Stripe event ledger

### Operations
- **files** — Storage metadata (pitch decks, PDFs, assets)
- **outbox_jobs** — Durable async workflow state (emails, PDFs, webhooks, exports)
- **audit_logs** — Immutable compliance trail

---

## Key Design Patterns

### 1. Versioned Rubrics
```sql
-- Admin creates template
INSERT INTO rubric_templates (name) VALUES ('Q1 Scoring');

-- At event go-live, create immutable version
INSERT INTO rubric_versions (rubric_template_id, version, event_id, definition)
VALUES (..., 1, $event_id, '{categories: [...]}');

-- Judges always score against frozen version
INSERT INTO judge_scores (judge_id, founder_pitch_id, rubric_version_id, responses)
VALUES ($judge, $pitch, $version_id, '{"market": {q1: 8}}');
```

Why? Ensures all judges score against identical rubric, even if template evolves for future events.

### 2. Audience Dedup
```sql
-- Unique constraint enforces one response per question per session
UNIQUE (audience_session_id, founder_pitch_id, question_id)

-- Duplicate attempt fails naturally
INSERT INTO audience_responses (...) -- if (session, pitch, question) exists, constraint violated
```

### 3. Outbox Pattern (Durable Async)
```sql
-- Transactionally insert both domain action and job
BEGIN;
  UPDATE founder_pitches SET is_published = true WHERE id = $pitch_id;
  INSERT INTO outbox_jobs (job_type, payload, state)
    VALUES ('email', '{to: founder@..., subject: ...}', 'pending');
COMMIT;

-- Worker picks up pending jobs, executes, marks complete
-- If process crashes, job retries on restart
```

### 4. RLS Enforcement
```sql
-- Every query runs through RLS policies
SELECT * FROM judge_scores; -- Judge sees only own scores
SELECT * FROM judge_scores; -- Admin sees all
SELECT * FROM events;        -- User sees only assigned events
```

### 5. Audit Trail
```sql
-- Every sensitive operation logged
INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, changes)
VALUES ($admin_id, 'lock_scores', 'founder_pitches', $pitch_id, '{before: {...}, after: {...}}');
```

---

## Relationships at a Glance

```
User
├─ role_assignments (1..many) — global admin, event judge, event founder, subscriber
├─ founders (1..1) — if accepted applicant
├─ judge_scores (1..many) — if judge
├─ mentor_matches (1..many) — if mentor
└─ files (1..many)

Event
├─ founder_pitches (1..many)
├─ audience_sessions (1..many)
├─ mentor_matches (1..many)
└─ sponsors (1..many)

Founder
└─ founder_pitches (1..many) — one per event

Founder Pitch
├─ judge_scores (1..many)
└─ audience_responses (1..many)

Rubric Version
└─ judge_scores (1..many)

Subscription
├─ orders (1..many)
└─ transactions (1..many)

Audience Session
└─ audience_responses (1..many)
```

---

## RLS Policies Summary

| Table | Admin | Judge | Founder | Mentor | Subscriber | Public |
|-------|-------|-------|---------|--------|-----------|--------|
| users | all | own | own | own | own | — |
| events | all | assigned | assigned | — | — | upcoming |
| scores | all | own | after publish | — | — | — |
| audience_sessions | all | — | — | — | — | create |
| audit_logs | select only | — | — | — | — | — |
| subscriptions | all | — | — | — | own | — |

All sensitive tables (role_assignments, outbox_jobs, audit_logs) are admin-only.

---

## Migration & Deployment

### Fresh Install
```bash
cd studio
npx supabase db push  # Applies all migrations in order
```

### Rollback (Dev Only)
```bash
# Careful: This drops all tables. Dev only!
psql < migrations/rollback_001.sql
```

### Point-in-Time Recovery (PITR)
1. Enable in Supabase: Project Settings → Backup
2. Retention: 7 days (recommended for compliance)
3. Restore: `SELECT * FROM pg_database_wal_lsn_diff(pg_current_wal_lsn(), '0/0');` to estimate recovery time

### Monitoring
```sql
-- Failed jobs
SELECT * FROM outbox_jobs WHERE state = 'dead_letter';

-- Stuck scores
SELECT * FROM judge_scores WHERE is_submitted AND updated_at < NOW() - INTERVAL '1 day';

-- Expired sessions
SELECT * FROM audience_sessions WHERE expires_at < NOW();
```

---

## Testing

### Schema Validation
```bash
npm test
# Runs 45+ tests verifying:
# - All tables exist
# - Constraints enforced
# - Relationships correct
# - Indexes created
# - RLS policies active
```

### Manual Tests
```bash
# Test as judge (see only own scores)
SELECT * FROM judge_scores;

# Test as founder (see own after publish)
SELECT * FROM judge_scores WHERE founder_pitch_id IN (
  SELECT id FROM founder_pitches WHERE founder_id = $founder AND is_published
);

# Test dedup (should fail on second insert)
INSERT INTO audience_responses (session_id, pitch_id, question_id, response)
  VALUES ($s1, $p1, 'q1', 'Yes');
INSERT INTO audience_responses (session_id, pitch_id, question_id, response)
  VALUES ($s1, $p1, 'q1', 'No');  -- ERROR: unique constraint
```

---

## FAQ

**Q: How do we handle role transitions?**  
A: Role assignments are immutable records. To change a role, delete old assignment and insert new one. All changes audited.

**Q: Can judges modify their scores after submission?**  
A: Yes, if scoring window isn't locked. revision_number tracks edits. Audit logs record all changes.

**Q: What's the max file size for pitch decks?**  
A: Supabase Storage limit is 5GB per file. Recommend enforcing 100MB in API layer.

**Q: How often should we test restore?**  
A: Monthly (or quarterly at minimum). Practice with staging DB to verify PITR works.

**Q: Can we delete a user's data?**  
A: Yes, but cascading deletes are aggressive (drops all user data). Create audit log first, then delete with caution.

---

## Performance Tips

### Query Optimization
- Indexes on `user_id`, `event_id`, `status`, `state` ✓ created
- For complex reports, consider materialized views
- JSONB queries: Use `->` operator (indexed) not `::text`

### Connection Pooling
- Supabase default: 10–50 connections
- Worker processes: Use service role with short-lived JWTs (15 min)

### JSONB Efficiency
- `rubric_versions.definition` can stay JSON (GIN indexed)
- `audit_logs.changes` can stay JSON (rarely queried)
- If needs complex queries, normalize into relational tables

---

## Related

- **PRD**: Issue #28 — Aurrin Ventures Event & Validation Platform
- **Auth**: Issue #29 — Authentication & RBAC implementation
- **Migrations**: `studio/src/lib/db/migrations/`
- **Test Suite**: `studio/test/schema.test.ts`

---

**Last Updated**: 2026-03-24  
**Schema Version**: 001  
**Status**: Ready for deployment
