# Frequently Asked Questions

## Table of Contents

- [Platform Basics](#platform-basics)
- [Troubleshooting](#troubleshooting)
- [Related Guides](#related-guides)

## Platform Basics

### What does the platform manage?
It supports event operations, founder application intake, rubric-based scoring, asynchronous jobs, storage, and role-based access.

### Who can access admin workflows?
Users with the `Admin` role and the proper scope can access protected admin routes and operational controls.

### How do judges submit scores?
Judges score assigned founder pitches using the active rubric version for an event. Once scores are locked, edits are blocked.

### When do founders see results?
Founders can view results after scores are published during the configured publishing window.

### Where is API behavior documented?
Use [API Reference](./API.md) for route contracts, auth expectations, and standard error responses.

## Troubleshooting

### I cannot sign in
- Confirm environment values and auth setup in [Authentication and RBAC](./AUTH.md).
- Verify the account exists and is not restricted by role scope.
- Check logs and health status via [Observability Guide](./OBSERVABILITY.md).

### Application uploads fail
- Confirm file size and MIME type requirements in [Storage Guide](./STORAGE.md).
- Ensure upload requests include required multipart fields.
- Retry after verifying signed URL and bucket constraints.

### Background jobs are delayed
- Inspect outbox states and retry behavior in [Background Job Infrastructure](./JOBS.md).
- Verify cron invocation and `CRON_SECRET` configuration in [Deployment Guide](./DEPLOYMENT.md).
- Review failure logs in [Observability Guide](./OBSERVABILITY.md).

### Data looks inconsistent between views
- Validate role assignment and RLS expectations in [Authentication and RBAC](./AUTH.md).
- Confirm relationship and policy coverage in [Database Schema](./DATABASE.md).
- Check recent audit events and job replay status.

### Deployment changed behavior unexpectedly
- Re-check environment variables and migration state in [Deployment Guide](./DEPLOYMENT.md) and [Development Guide](./DEVELOPMENT.md).
- Confirm the latest release includes required schema migrations.

## Related Guides

- [Documentation Hub](./README.md)
- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API.md)
- [Database Schema](./DATABASE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Operations Runbook](./OPERATIONS.md)
- [Admin Guide](./ADMIN_GUIDE.md)
- [Judge Guide](./JUDGE_GUIDE.md)
- [Founder Application Guide](./FOUNDER_APPLICATION.md)
- [Founder Portal Guide](./FOUNDER_PORTAL.md)
- [Mentor Matching Guide](./MENTOR_MATCHING.md)
- [Subscriber Guide](./SUBSCRIBER_GUIDE.md)
- [Development Guide](./DEVELOPMENT.md)
- [Style Guide](./STYLE.md)
- [Storage Guide](./STORAGE.md)
- [Background Jobs](./JOBS.md)
- [Observability Guide](./OBSERVABILITY.md)
