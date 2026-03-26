# Email Operations Guide

This guide covers how to use the platform email utilities, add templates, and preview email output safely from an admin-only endpoint.

## Send an Email with `sendEmail`

Use `sendEmail` from server-side code (route handlers, jobs, or server actions):

```typescript
import { sendEmail } from '@/lib/email/send';

await sendEmail('founder@example.com', 'welcome_founder', {
  name: 'Jane Founder',
  company: 'Orbit Labs',
  link: 'https://app.aurrin.ventures/founder/dashboard',
  date: '2026-03-26',
});
```

Behavior notes:
- `sendEmail` enqueues a `send_email` outbox job.
- It does not send directly in request/response flow.
- Payload shape in outbox is `{ to, template_name, data }`.

## Add a New Email Template

1. Add a new template file in `studio/src/lib/email/templates/` (for example `new_template.tsx`).
2. Export a template object with a `render(data)` function returning:
- `subject`
- `html`
- `text`
3. Register the template in `studio/src/lib/email/templates/index.ts`:
- add it to `emailTemplateRegistry`
- ensure the key matches the desired `template_name`
4. Add or update tests in `studio/test/email-templates.test.ts` and any route/job tests that reference the new template.

## Template Variables and Personalization

Templates accept `EmailTemplateData` and commonly use:
- `name`
- `company`
- `link`
- `date`
- `email`
- `baseUrl`
- `unsubscribeToken`

All templates should keep personalization optional and produce valid fallback output when a field is missing.

## Testing and Previewing Templates

Use the admin-only preview endpoint:

- `GET /api/admin/emails/preview?template={name}&data={json}`

Example:

```bash
curl -i \
  -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:3000/api/admin/emails/preview?template=welcome_founder&data=%7B%22name%22%3A%22Jane%20Founder%22%2C%22company%22%3A%22Orbit%20Labs%22%2C%22link%22%3A%22https%3A%2F%2Fexample.com%2Fportal%22%2C%22date%22%3A%222026-03-26%22%7D"
```

Route behavior:
- Returns rendered HTML for supported templates.
- Returns `404` for unknown template names.
- Returns `400` for malformed or invalid `data` JSON.
- Uses the same admin authorization pattern as other `/api/admin/*` endpoints.

## Resend Dashboard and Delivery Reports

Delivery execution occurs in the email job handler with Resend integration. Operators should use:

- Resend dashboard for delivery and provider-side status
- Application logs for structured email job events (`to`, `template`, `job_id`, `status`, `duration`)
- Outbox job records for retry state and persisted delivery metadata (`email_id`, `error_message`)

## Validation Commands

Exact local validation commands used for preview endpoint and template workflow:

```bash
bash scripts/validate-implementation.sh
```

```bash
APP_ROOT=$(bash scripts/resolve-nextjs-app-root.sh) && cd "$APP_ROOT" && npm test -- --runInBand test/admin-api-auth-guard.test.ts
```

```bash
APP_ROOT=$(bash scripts/resolve-nextjs-app-root.sh) && cd "$APP_ROOT" && npm test -- --runInBand test/admin-email-preview-route.test.ts test/email-templates.test.ts
```
