import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { getStripeClient } from '../../../../lib/payments/stripe-client';

interface CheckoutPayload {
  price_id: string;
  success_url: string;
  cancel_url: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCheckoutPayload(body: unknown): body is CheckoutPayload {
  if (!isObject(body)) {
    return false;
  }

  const keys = Object.keys(body).sort();
  const expected = ['cancel_url', 'price_id', 'success_url'];
  if (keys.length !== expected.length) {
    return false;
  }

  return expected.every((key, index) => key === keys[index])
    && typeof body.price_id === 'string'
    && typeof body.success_url === 'string'
    && typeof body.cancel_url === 'string';
}

function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON body.',
        },
      },
      { status: 400 }
    );
  }

  if (!isCheckoutPayload(body)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Body must be exactly { price_id, success_url, cancel_url }.',
        },
      },
      { status: 400 }
    );
  }

  if (!isValidUrl(body.success_url) || !isValidUrl(body.cancel_url)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'success_url and cancel_url must be valid URLs.',
        },
      },
      { status: 400 }
    );
  }

  if (DEMO_MODE) {
    const successUrl = new URL(body.success_url);
    successUrl.searchParams.set('demo_checkout', body.price_id);
    return NextResponse.json(
      {
        success: true,
        sessionId: `demo-session-${body.price_id}`,
        checkoutUrl: successUrl.toString(),
      },
      { status: 200 }
    );
  }

  try {
    const stripe = getStripeClient();
    const price = await stripe.prices.retrieve(body.price_id);

    const session = await stripe.checkout.sessions.create({
      mode: price.recurring ? 'subscription' : 'payment',
      line_items: [{ price: body.price_id, quantity: 1 }],
      success_url: body.success_url,
      cancel_url: body.cancel_url,
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        checkoutUrl: session.url,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create Stripe Checkout Session.',
      },
      { status: 500 }
    );
  }
}
