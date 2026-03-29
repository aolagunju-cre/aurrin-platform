# Development Setup Guide

## Prerequisites

- Node.js (LTS recommended)
- npm
- git
- GitHub account

## How-to: Clone and install

1. Clone the repository with git.
2. Change into the app root (`studio`).
3. Install dependencies.

```bash
git clone <repo-url>
cd aurrin-platform/studio
npm install
```

## How-to: Configure local environment

1. Copy `.env.example` to `.env.local`.
2. Fill Supabase keys and auth settings.
3. Add Stripe/Resend keys only if you are testing those integrations locally.

```bash
cp .env.example .env.local
```

Required core values include:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- `SUPABASE_JWT_SECRET` for local JWT verification. If omitted, the app uses Supabase token introspection.

## How-to: Optional local Supabase setup

You can use hosted Supabase, or run Supabase locally with Docker or Supabase CLI.

- Docker path: use Supabase local stack instructions.
- CLI path: initialize and run the local stack with Supabase CLI commands.

## How-to: Run migrations and seed data

```bash
npm run db:migrate
npm run db:seed
```

If these scripts are not yet wired in your branch snapshot, run the migration flow defined by current project scripts and SQL migration files.

## How-to: Run the application

```bash
npm run dev
```

Open `http://localhost:3000`.

## How-to: Run tests

```bash
npm test
bash scripts/validate-implementation.sh
```

## Common issues and solutions

### Build fails with missing env vars
Check `.env.local` exists and contains Supabase keys.

### Auth-protected APIs return `401`
Make sure your request includes an `Authorization` header with a valid Bearer token.

### Stripe or email tests fail locally
Verify API keys and webhook configuration for test mode.

### Migration mismatch or schema drift
Re-check migration ordering in `studio/src/lib/db/migrations` and apply missing migrations in sequence.
