# Analytics Dashboard

This guide explains how administrators use the analytics dashboard, what each metric means, how cohort values are calculated, and what the export formats contain.

## Access and Navigation

- Route: `/admin/analytics` (protected admin area)
- Access control: admin-only via the existing admin auth guard (`401` unauthenticated, `403` non-admin)
- UI file: `studio/src/app/(protected)/admin/analytics/page.tsx`

## Date Filtering

The dashboard supports these ranges:

- Last 30 days
- Quarter
- Year
- All-time
- Custom start and end date

The selected range is passed to analytics APIs through query params:

- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`

If `all-time` is selected, date params are omitted.

## Metrics and Charts

### KPI Cards

Source API: `GET /api/admin/analytics/kpis?startDate=X&endDate=Y`

Returned fields:

- `totalEvents`
- `totalFounders`
- `totalJudges`
- `totalScoresSubmitted`
- `totalValidationResponses`
- `activeSubscriptions`
- `mrr` (stored as cents, rendered as USD)

### Founder Scores

Source API: `GET /api/admin/analytics/founder-scores?startDate=X&endDate=Y`

Returned fields:

- `histogram[]` with `{ range, count }`
- `trends[]` with `{ eventId, eventName, date, averageScore }`

Histogram bins are fixed to the scoring scale:

- `0-20`
- `20-40`
- `40-60`
- `60-80`
- `80-100`

### Validation Metrics

Source API: `GET /api/admin/analytics/validation?startDate=X&endDate=Y`

Returned fields:

- `participationPerEvent[]` with `{ eventId, eventName, date, founderPitches, averageScore }`
- `ratingDistribution[]` with `{ range, count }`
- `averageRating`
- `totalValidationResponses`

### Mentoring Metrics

Source API: `GET /api/admin/analytics/mentoring?startDate=X&endDate=Y`

Returned fields:

- `matchAcceptanceRate`
- `matchAcceptanceRatePercent`

### Revenue Metrics

Source API: `GET /api/admin/analytics/revenue?startDate=X&endDate=Y`

Returned fields:

- `mrr`
- `mrrTrend[]` with `{ month, amountCents }`
- `churnRate`
- `churnRateByMonth[]` with `{ month, amountCents }`
- `subscriptionTotals` with `{ active, cancelled, total }`

## Cohort Analysis Methodology

Source API: `GET /api/admin/analytics/cohorts?startDate=X&endDate=Y`

Cohort groups returned by the API:

- `byFounderStage[]`
- `byIndustry[]`
- `byEventCohort[]`

### By Stage and By Industry

Rows contain:

- `value` (stage or industry bucket)
- `count`
- `averageScore`
- `averageValidationRating`

Interpretation:

- `count` is the number of founder records in that cohort.
- `averageScore` is the mean founder score in that cohort.
- `averageValidationRating` is the mean audience validation rating in that cohort.

### By Event Cohort

Rows contain:

- `eventId`
- `eventName`
- `date`
- `count`
- `averageScore`
- `matchedWithMentorsRate`
- `retentionToNextEventRate`

Interpretation:

- `matchedWithMentorsRate` is the share of founders in the cohort with a mentor match.
- `retentionToNextEventRate` is the share of founders who return to a later event cohort.

## Export Report Format

Source API: `GET /api/admin/analytics/export?type=csv|json&startDate=X&endDate=Y`

Rules:

- Admin-only endpoint
- `type` must be `csv` or `json`
- Download filename is timestamped: `analytics-export-<timestamp>.<type>`

### JSON Export

Response body:

- `success`
- `exportedAt`
- `data`

`data` contains these required top-level sections:

- `events`
- `founders`
- `scores`
- `validation`
- `subscriptions`
- `revenue`

### CSV Export

CSV has deterministic section ordering and a fixed header:

- `section,metric,date,eventId,eventName,range,cohort,month,value,count,amountCents,averageScore`

The CSV includes metric rows for each required domain (`events`, `founders`, `scores`, `validation`, `subscriptions`, `revenue`) so downstream imports can verify integrity by section and metric keys.

## Performance Notes

Current safeguards and guidance:

- Date range filtering is available on every analytics endpoint to limit dataset size.
- Query layer uses a 5-minute cache TTL for aggregate analytics calls.
- Existing analytics query code is designed for indexed/filterable fields (especially date and cohort dimensions).

For larger datasets, use these operational practices:

- Prefer narrower date windows for interactive dashboard use.
- Monitor query latency for `kpis`, `founder-scores`, `validation`, `mentoring`, `revenue`, `cohorts`, and `export` routes.
- Add or tune indexes when date/cohort scans become hot.
- Consider materialized views or ETL pre-aggregation for very large historical analytics workloads.
