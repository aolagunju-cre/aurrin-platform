# Aurrin Ventures Platform

A full-stack event and validation platform for Aurrin Ventures — built and maintained by an autonomous agent pipeline powered by [prd-to-prod](https://prdtoprod.com).

## What this is

Aurrin Ventures runs monthly pitch nights for early-stage founders in Calgary. They award microgrants, connect founders with judges and mentors, and track validation data from live audiences.

This repo replaces a static Next.js marketing site (data in JSON files, every change requires a deploy) with a real platform: event management, founder applications, dynamic scoring rubrics, audience validation via QR codes, mentor matching, Stripe payments, downloadable reports, and a public founder directory.

12 core modules. 6 user roles. 3 delivery phases.

## How it works

This repository is agent-first. You describe what you want as a GitHub issue. The pipeline ships it.

1. **Auto-dispatch** — file a GitHub issue describing a feature or bug. The pipeline picks it up, assigns an agent, and begins implementation.
2. **Independent review** — a separate agent reviews every PR. The builder and reviewer are never the same identity.
3. **Self-healing CI** — when CI breaks, the pipeline detects the failure, creates a fix issue, assigns an agent, and resolves it.
4. **Deploy on merge** — approved PRs merge and deploy automatically.
5. **Complete audit trail** — every decision is traceable in the repo history.

No sprint planning. No standups. No context loss.

## Tech stack

- **Web tier:** Next.js on Vercel (`studio/`)
- **Database:** PostgreSQL via Supabase (replaces JSON file storage)
- **Auth:** Supabase Auth + database-backed RBAC (6 roles, scoped permissions)
- **Payments:** Stripe (subscriptions, digital products, event tickets)
- **Email:** Resend (transactional notifications, invites, reports)
- **Realtime:** Supabase Realtime (live scoring during pitch events)
- **Storage:** Supabase Storage (pitch decks, PDFs, generated assets)
- **Pipeline:** GitHub Agentic Workflows (gh-aw)

## Delivery phases

**Phase 1:** Database + migrations, auth/RBAC, background jobs, object storage, observability, admin dashboard, founder applications, judge scoring, event management

**Phase 2:** Audience validation (QR codes), founder portal with PDF reports, public founder directory, social asset generation, Stripe payments

**Phase 3:** Mentor matching engine, additional revenue models, advanced analytics, ecosystem intelligence exports

## Setup

```bash
./setup.sh
```

The interactive wizard configures secrets, deployment, and pipeline authentication. Run `./setup-verify.sh` afterward to confirm everything is connected.

See [issue #1](https://github.com/Aurrin-Ventures/aurrin-platform/issues/1) for the full setup checklist.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design and architecture decision records.

Full technical architecture and ADRs: [prdtoprod.com/case-studies/aurrin-ventures/architecture](https://prdtoprod.com/case-studies/aurrin-ventures/architecture)

## Human boundaries

The autonomous pipeline is bounded by `autonomy-policy.yml`. Humans control:

- Product intent and acceptance criteria
- Policy definitions and authority expansion
- Secrets, tokens, and deployment targets
- Authentication, compliance, and payment logic (require human review)
