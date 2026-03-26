# Payments Guide

## How subscriptions work
- Subscription checkout is created server-side through `POST /api/commerce/checkout` using Stripe Checkout.
- Stripe webhook events (`customer.subscription.created`, `customer.subscription.updated`, `payment_intent.succeeded`, `charge.refunded`, `invoice.payment_failed`) are processed by `studio/src/lib/payments/webhook-handler.ts`.
- Subscription state is cached in the local `subscriptions` table and used for resilient access checks when Stripe is temporarily unavailable.
- Entitlements are granted from subscription events and purchase records, then used to gate premium resources.

## How to set up products in Stripe
1. Create a Stripe Product in the Stripe dashboard.
2. Create one or more recurring Prices on that product (for example monthly and yearly).
3. Copy Stripe IDs into local records (`products.stripe_product_id`, `prices.stripe_price_id`) using admin commerce APIs.
4. Ensure `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` are configured in the environment.

## Webhook handling and idempotency
- Webhook endpoint: `POST /api/commerce/webhooks/stripe`.
- Signature verification uses `STRIPE_WEBHOOK_SECRET`; invalid signatures return `403`.
- Idempotency is enforced with `transactions.stripe_event_id`.
- Replayed Stripe events return success without duplicate writes.
- Processing failures are dead-lettered to outbox jobs so retries remain centralized in the jobs processor.
- A reconciliation job (`subscription_reconcile`) runs hourly through cron-triggered scheduling to correct drift between Stripe and local subscription state.

## Entitlement checks
- Core utility: `hasEntitlement(userId, productId)` in `studio/src/lib/payments/entitlements.ts`.
- Access is granted for active subscriptions or valid purchase/subscription entitlements.
- Premium API routes (for example `/api/content/[id]`) call this utility before returning protected content.

## Testing with Stripe test keys
1. Set Stripe test environment variables in local `.env` (test keys and webhook secret).
2. Run tests:
   - `bash scripts/validate-implementation.sh`
   - `cd studio && npm test -- --runInBand test/webhook-handler.test.ts test/subscription-reconciliation.test.ts test/reconciliation-jobs.test.ts`
3. Use Stripe test events or fixtures to verify:
   - subscription creation/updating and transaction persistence
   - webhook idempotency replay behavior
   - reconciliation drift correction
   - payment-failed notification emission
