# API Reference

This API reference documents currently implemented routes under `studio/src/app/api/**` and maps them by domain. Domains not yet implemented are marked as planned.

## Authentication

Authenticated endpoints require a JWT in the Authorization header using Bearer token format.

- Header: `Authorization: Bearer <jwt>`
- Missing/invalid token responses use `401`.

## Rate Limits

Platform contract defaults:
- Public/standard traffic: 100 req/min
- Authenticated/internal traffic: 1000 req/min

## Errors

Common API error codes: 400, 401, 403, 404, 409, 500

## Pagination

Standard list pagination contract: limit, offset

Current routes are mostly single-resource or unpaginated list endpoints; list APIs should adopt `limit` and `offset` when expanded.

## Domains

### Admin

#### GET `/api/admin/ping`
- Auth: Admin
- Purpose: Verify admin route protection path
- Response 200:
```json
{ "ok": true, "message": "Admin access verified" }
```

#### GET `/api/admin/rubrics`
- Auth: Admin
- Purpose: List rubric templates with latest version summary
- Response 200: `{ success: true, data: RubricSummary[] }`

#### POST `/api/admin/rubrics`
- Auth: Admin
- Purpose: Create rubric template and version `1`
- Request body (example):
```json
{
  "name": "Pitch Night Rubric",
  "description": "Default scoring rubric",
  "definition": {
    "categories": [
      {
        "id": "problem",
        "name": "Problem",
        "weight": 40,
        "questions": [
          { "id": "clarity", "prompt": "Problem clarity", "scale": { "min": 1, "max": 5 } }
        ]
      },
      {
        "id": "solution",
        "name": "Solution",
        "weight": 60,
        "questions": [
          { "id": "fit", "prompt": "Solution fit", "scale": { "min": 1, "max": 5 } }
        ]
      }
    ]
  }
}
```
- Response 201: `{ success: true, data: { template, version } }`

#### GET `/api/admin/rubrics/:id`
- Auth: Admin
- Purpose: Fetch rubric template with all versions and latest version
- Response 200: `{ success: true, data: { template, versions, latest } }`

#### PATCH `/api/admin/rubrics/:id`
- Auth: Admin
- Purpose: Create a new immutable rubric version and optionally update template metadata
- Response 200: `{ success: true, data: { template_id, previous_version_id, version } }`

#### POST `/api/admin/rubrics/:id/clone`
- Auth: Admin
- Purpose: Clone rubric template and latest definition into a new template/version
- Request body (optional): `{ "name": "New Rubric Name" }`
- Response 201: `{ success: true, data: { template, version } }`

### Founder Intake and Review

#### POST `/api/public/apply`
- Auth: Public
- Purpose: Founder application intake with deck upload
- Content type: `multipart/form-data`
- Required fields:
  - `full_name`
  - `email`
  - `company_name`
  - `pitch_summary` (100-1000 chars)
  - `industry`
  - `stage`
  - `deck_file` (PDF, <= 50MB)
- Optional fields: `website`, `twitter`, `linkedin`
- Response 200: `{ success: true, message: "Application submitted" }`
- Validation failure response 400: `{ success: false, message, errors }`

#### PATCH `/api/protected/admin/founder-applications/:applicationId`
- Auth: Admin (validated by role assignment checks)
- Purpose: Transition application status (`accepted`, `assigned`, `declined`)
- Request body:
```json
{
  "status": "assigned",
  "assigned_event_id": "event_uuid_when_required"
}
```
- Rules:
  - `assigned_event_id` required when `status=assigned`
  - Status transition conflicts return `409`
- Response 200: `{ success: true, message, data: { id, status, assigned_event_id } }`

### Files and Media

#### POST `/api/upload`
- Auth: Bearer JWT required
- Purpose: Upload a file to supported storage buckets and receive signed access URL
- Content type: `multipart/form-data`
- Fields:
  - `file`: file binary
  - `bucket`: one of `pitch-decks`, `generated-reports`, `social-assets`, `exports`
- Response 200:
```json
{
  "file_id": "uuid",
  "path": "bucket/path/file.pdf",
  "signed_url": "https://..."
}
```

### Operations

#### GET `/api/cron/jobs`
- Auth: `CRON_SECRET` bearer check when configured
- Purpose: Process pending outbox jobs
- Response 200: `{ ok: true, ...processorResult }`
- Unauthorized response 401 when secret does not match

#### GET `/api/health`
- Auth: Public
- Purpose: Service health check for DB and storage integrations
- Response 200/503:
```json
{
  "status": "ok|degraded|error",
  "timestamp": "2026-03-26T00:00:00.000Z",
  "version": "0.0.0",
  "checks": {
    "db": { "status": "ok", "latency_ms": 12 },
    "storage": { "status": "ok", "latency_ms": 15 }
  }
}
```

## Planned Domains

The following domains are defined by the PRD but route-level APIs are planned or partially implemented:
- Judge scoring and assignments
- Mentor workflows
- Subscriber and commerce endpoints
- Audience validation endpoints

When introduced, new list endpoints should use `limit`/`offset` and maintain the same auth/error contract documented above.

## Example Requests

### cURL: Public founder apply
```bash
curl -X POST https://example.com/api/public/apply \
  -F "full_name=Jane Founder" \
  -F "email=jane@example.com" \
  -F "company_name=Acme Labs" \
  -F "pitch_summary=$(cat pitch-summary.txt)" \
  -F "industry=Fintech" \
  -F "stage=Seed" \
  -F "deck_file=@deck.pdf;type=application/pdf"
```

### cURL: Authenticated upload
```bash
curl -X POST https://example.com/api/upload \
  -H "Authorization: Bearer <jwt>" \
  -F "bucket=pitch-decks" \
  -F "file=@deck.pdf;type=application/pdf"
```
