# Deployment Guide

This guide covers production deployment for the `nextjs-vercel` profile (`studio/` app root) with Supabase as the backing platform.

## 1. Vercel Setup

1. From repository root, link the project:
   `vercel link`
2. Confirm the Vercel project points to `studio` as the root directory.
3. Configure production and preview branches in Vercel project settings.

## 2. Supabase Setup

1. Create a Supabase project for each environment (dev, staging, prod).
2. Store each environment's URL and keys.
3. Enable point-in-time recovery for production.

## 3. Environment Variable Matrix

Use separate environment variable values for dev, staging, and prod.

| Variable | dev | staging | prod |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | env-specific Supabase URL | env-specific Supabase URL | env-specific Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | anon key | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service key | service key | service key |
| `SUPABASE_JWT_SECRET` | jwt secret | jwt secret | jwt secret |
| `RESEND_API_KEY` | optional for local test | required if email enabled | required |
| `STRIPE_SECRET_KEY` | test key | test key | live key |
| `CRON_SECRET` | optional | required | required |
| `LOG_LEVEL` | debug/info | info | info/warn |
| `SENTRY_DSN` | optional | optional | recommended |

Supabase auth baseline requires all four keys to be set together in non-demo deployments:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

If one or more are missing, runtime falls back to demo mode unless `DEMO_MODE=false` is explicitly set.

## 4. Install, Build, and Test

Run from repository root:

```bash
APP_ROOT=$(bash scripts/resolve-nextjs-app-root.sh)
cd "$APP_ROOT"
npm ci
npm run build
npm test
```

## 5. Migration Procedure

Schema migration must run before traffic cutover.

```bash
bash scripts/run-supabase-migrations.sh
```

The migration runner validates required Supabase credentials up front and fails with an explicit missing-variable list when configuration is incomplete.

For manual migration execution, apply SQL files in `studio/src/lib/db/migrations/` in order.

After migration, verify baseline auth-contract tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'role_assignments', 'events', 'founder_applications', 'sponsors')
ORDER BY table_name;
```

## 6. Backups and Recovery

- Enable Supabase automated backups and point-in-time recovery.
- Define recovery objectives (RPO/RTO) per environment.
- Run a monthly restore drill in staging from a recent backup.

## 7. Monitoring Hooks

After deploy, verify:

1. `GET /api/health` status and latency.
2. Structured logs for request and worker traffic.
3. metrics (job failures, API latency, auth failures) from the observability layer.
4. error tracking alerts (for example Sentry) for new exceptions.

## 8. Deployment Checklist

- migration applied and verified
- environment values reviewed for target environment
- build/test gate passed (`bash scripts/validate-implementation.sh`)
- `/api/health` healthy in target environment
- logs, metrics, and error tracking confirmed
