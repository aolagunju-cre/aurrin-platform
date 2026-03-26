import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../lib/db/client';
import { getStripeClient } from '../../../../../lib/payments/stripe-client';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const db = getSupabaseClient().db;
  const stripe = getStripeClient();
  const localProducts = await db.listProducts(false);
  if (localProducts.error) {
    return NextResponse.json({ success: false, message: 'Could not read local products.' }, { status: 500 });
  }

  const stripeProducts = await stripe.products.list({ active: true, limit: 100 });
  let createdProducts = 0;
  let updatedProducts = 0;
  let createdPrices = 0;
  let updatedPrices = 0;

  for (const stripeProduct of stripeProducts.data) {
    const existing = localProducts.data.find((product) => product.stripe_product_id === stripeProduct.id);
    let localProductId = existing?.id;

    if (!existing) {
      const inserted = await db.insertProduct({
        name: stripeProduct.name,
        description: stripeProduct.description,
        stripe_product_id: stripeProduct.id,
        active: stripeProduct.active,
      });
      if (inserted.error || !inserted.data) {
        continue;
      }
      localProductId = inserted.data.id;
      createdProducts += 1;
    } else {
      const updated = await db.updateProduct(existing.id, {
        name: stripeProduct.name,
        description: stripeProduct.description,
        active: stripeProduct.active,
      });
      if (!updated.error) {
        updatedProducts += 1;
      }
    }

    if (!localProductId) {
      continue;
    }

    const localPrices = await db.listPricesByProductId(localProductId, false);
    if (localPrices.error) {
      continue;
    }

    const stripePrices = await stripe.prices.list({ product: stripeProduct.id, active: true, limit: 100 });
    for (const stripePrice of stripePrices.data) {
      const recurringInterval = stripePrice.recurring?.interval;
      if (recurringInterval !== 'month' && recurringInterval !== 'year') {
        continue;
      }
      const billingInterval = recurringInterval === 'month' ? 'monthly' : 'yearly';
      const existingPrice = localPrices.data.find((price) => price.stripe_price_id === stripePrice.id);
      if (!existingPrice) {
        const inserted = await db.insertPrice({
          product_id: localProductId,
          stripe_price_id: stripePrice.id,
          amount_cents: stripePrice.unit_amount ?? 0,
          currency: stripePrice.currency.toUpperCase(),
          billing_interval: billingInterval,
          active: stripePrice.active,
        });
        if (!inserted.error) {
          createdPrices += 1;
        }
      } else {
        const updated = await db.updatePrice(existingPrice.id, {
          amount_cents: stripePrice.unit_amount ?? existingPrice.amount_cents,
          currency: stripePrice.currency.toUpperCase(),
          billing_interval: billingInterval,
          active: stripePrice.active,
        });
        if (!updated.error) {
          updatedPrices += 1;
        }
      }
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: { createdProducts, updatedProducts, createdPrices, updatedPrices },
    },
    { status: 200 }
  );
}
