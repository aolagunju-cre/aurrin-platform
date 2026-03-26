# Subscriber Guide

This guide covers subscription management, entitlement behavior, and premium content access.

## How-to: Start a subscription

1. Select a price from the public subscribe flow (`/public/subscribe/[priceId]`).
2. Complete Stripe Checkout.
3. Stripe webhook processing updates local subscription records.

## How-to: Use subscriber dashboard

1. Sign in and open `/subscriber`.
2. Review your subscription rows (product, price, next billing date, status).
3. Select **Manage** to open Stripe Billing Portal.
4. Select **Cancel Subscription** to request cancellation for Stripe-managed subscriptions.

## How-to: Understand entitlements and premium access

1. Premium content routes check entitlements before returning protected data.
2. Access can come from active subscription state or granted purchase/subscription entitlements.
3. If entitlement checks fail, premium content remains unavailable.

## Planned / partial areas

- Subscriber dashboard UX is functional but intentionally minimal.
- Additional premium-content UX and deeper self-service controls are planned.

## FAQ

### Why do I get unauthorized responses on subscriber APIs?
Subscriber routes require a valid Bearer token.

### Why can’t I cancel some subscriptions?
Cancellation route supports Stripe-managed subscriptions with linked Stripe subscription IDs.

### Why can’t I open billing portal for some records?
Billing portal requires a linked Stripe customer ID.

### What happens after cancellation?
The system updates cancellation state and billing end-date fields, then entitlement access follows configured period boundaries.
