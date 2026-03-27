# Documentation Hub

This hub is the canonical entrypoint for platform documentation under `studio/docs/`.

## Table of Contents

- [Getting Started (5 Minutes)](#getting-started-5-minutes)
- [Common Tasks](#common-tasks)
- [Documentation Map](#documentation-map)
- [Reference and Support](#reference-and-support)

## Getting Started (5 Minutes)

1. Review platform structure in [Architecture](./ARCHITECTURE.md).
2. Validate auth and access expectations in [Authentication and RBAC](./AUTH.md).
3. Check API contracts in [API Reference](./API.md).
4. Confirm runtime controls in [Operations Runbook](./OPERATIONS.md).
5. Use [FAQ](./FAQ.md) and [Glossary](./GLOSSARY.md) for quick answers and terminology.

## Common Tasks

- Add or update event operations: [Admin Guide](./ADMIN_GUIDE.md) and [Operations Runbook](./OPERATIONS.md)
- Review and score founder submissions: [Judge Guide](./JUDGE_GUIDE.md)
- Submit or track founder intake: [Founder Application Guide](./FOUNDER_APPLICATION.md) and [Founder Portal Guide](./FOUNDER_PORTAL.md)
- Manage mentor workflows: [Mentor Matching Guide](./MENTOR_MATCHING.md)
- Handle subscriber and entitlement flows: [Subscriber Guide](./SUBSCRIBER_GUIDE.md)
- Run local development setup: [Development Guide](./DEVELOPMENT.md)
- Follow implementation conventions: [Style Guide](./STYLE.md)
- Troubleshoot jobs, metrics, and logs: [Background Jobs](./JOBS.md), [Observability Guide](./OBSERVABILITY.md)
- Work with file uploads and retention: [Storage Guide](./STORAGE.md)
- Resolve platform questions quickly: [FAQ](./FAQ.md)

## Documentation Map

### Platform Architecture and Contracts

- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API.md)
- [Audience Validation Runbook](./AUDIENCE_VALIDATION.md)
- [Database Schema](./DATABASE.md)
- [Authentication and RBAC](./AUTH.md)

### Platform Operations

- [Deployment Guide](./DEPLOYMENT.md)
- [Operations Runbook](./OPERATIONS.md)
- [Observability Guide](./OBSERVABILITY.md)
- [Background Jobs](./JOBS.md)
- [Storage Guide](./STORAGE.md)
- [Email Guide](./EMAIL.md)
- [Analytics Guide](./ANALYTICS.md)
- [Payments Guide](./PAYMENTS.md)

### Role Guides

- [Admin Guide](./ADMIN_GUIDE.md)
- [Judge Guide](./JUDGE_GUIDE.md)
- [Founder Application Guide](./FOUNDER_APPLICATION.md)
- [Founder Portal Guide](./FOUNDER_PORTAL.md)
- [Mentor Matching Guide](./MENTOR_MATCHING.md)
- [Subscriber Guide](./SUBSCRIBER_GUIDE.md)

### Developer References

- [Development Guide](./DEVELOPMENT.md)
- [Style Guide](./STYLE.md)
- [Glossary](./GLOSSARY.md)
- [Frequently Asked Questions](./FAQ.md)

## Reference and Support

- If documentation and implementation diverge, code and migrations are authoritative for runtime behavior.
- Update relevant docs in the same change when APIs, schema, or role behavior changes.
- Use relative links within `studio/docs/` to keep navigation stable across environments.
