# Monetization Operations (Phase 3)

This runbook documents the monetization features implemented in Phase 3 and the areas intentionally deferred to future phases.

## Digital Products: Create, Upload, Manage Downloads

### Admin operations
- Admin UI: `studio/src/app/(protected)/admin/products/digital/page.tsx`
- API for create/list: `POST` and `GET` `studio/src/app/api/commerce/products/digital/route.ts`
- API for update/delete: `PATCH` and `DELETE` `studio/src/app/api/commerce/products/digital/[productId]/route.ts`
- File upload API: `POST` `studio/src/app/api/commerce/products/digital/upload/route.ts`
- Download API (entitlement required): `GET` `studio/src/app/api/products/[productId]/download/route.ts`

### Purchase and fulfillment flow
1. Customer starts checkout through `POST /api/commerce/checkout`.
2. Stripe sends `payment_intent.succeeded` to `POST /api/commerce/webhooks/stripe`.
3. Webhook processing grants entitlement for digital products (`source = purchase`) in `studio/src/lib/payments/webhook-handler.ts`.
4. If the product has a file, an outbox email job is enqueued with the `digital_product_download` template.
5. Authenticated users can request `GET /api/products/[productId]/download`; access is denied without entitlement.
6. Authorized requests receive a signed URL for the product file.

### Access types
- `perpetual`: entitlement has no expiry timestamp.
- `time-limited`: entitlement expiry is resolved from webhook metadata (`entitlement_expires_at` or `entitlement_duration_days`).

## Sponsored Placements: Tiers, Visibility, Duration

### Admin-managed model
- Admin UI: `studio/src/app/(protected)/admin/sponsors/page.tsx`
- Admin APIs:
  - `GET`/`POST` `studio/src/app/api/admin/sponsors/route.ts`
  - `PATCH`/`DELETE` `studio/src/app/api/admin/sponsors/[sponsorId]/route.ts`
- Public listing API: `GET` `studio/src/app/api/public/sponsors/route.ts`

This is an admin-managed sponsorship model, not a self-serve flow.

### Tier defaults and placement
Default tier pricing (USD):
- bronze: `$500` (`50000` cents)
- silver: `$1000` (`100000` cents)
- gold: `$2500` (`250000` cents)

Tier defaults are sourced from `studio/src/lib/sponsors/tier-config.ts` and can be overridden with `SPONSOR_TIER_CONFIG_JSON`.

Public sponsor ordering uses tier prominence first (higher-priced tier first), then display priority, then creation timestamp for stable ordering.

### Visibility and duration
- `site-wide` sponsors are returned publicly without authentication.
- `event` sponsors are returned when `event_id` is provided.
- Only active, non-expired sponsors are shown publicly.
- Sponsor cards expose display-safe fields only: `logo`, `name`, optional `link`.

## Revenue Reporting and Analytics

### In-product reporting currently available
- Digital products admin page shows aggregated `sales_count` and `revenue_cents` totals from product records.
- Sponsor records persist `pricing_cents`, scope, status, and end-date for operational tracking.
- Stripe webhook transactions are persisted for payment event history and reconciliation.

### Operational references
- Payments and webhook operations: `studio/docs/PAYMENTS.md`
- Analytics and observability guidance: `studio/docs/ANALYTICS.md`, `studio/docs/OBSERVABILITY.md`

## Future Revenue Streams (Documented, Not Implemented in Phase 3)

The following are explicitly out of scope for Phase 3 and are documented only:
- Job board listings (paid founder postings)
- Paid founder upgrades (premium profile features)
- Workshop/event sponsorship packages
- Refer-a-founder program
