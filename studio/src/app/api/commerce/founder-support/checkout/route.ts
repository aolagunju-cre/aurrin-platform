import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '../../../../../lib/demo/data';
import { getStripeClient } from '../../../../../lib/payments/stripe-client';

interface FounderSupportCheckoutPayload {
  founder_slug: string;
  founder_name: string;
  founder_id?: string | null;
  donor_email: string;
  amount_cents: number;
  success_url: string;
  cancel_url: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function validatePayload(body: unknown): FounderSupportCheckoutPayload | null {
  if (!isObject(body)) {
    return null;
  }

  const founderSlug = typeof body.founder_slug === 'string' ? body.founder_slug.trim() : '';
  const founderName = typeof body.founder_name === 'string' ? body.founder_name.trim() : '';
  const founderId =
    typeof body.founder_id === 'string' && body.founder_id.trim().length > 0
      ? body.founder_id.trim()
      : null;
  const donorEmail = typeof body.donor_email === 'string' ? body.donor_email.trim().toLowerCase() : '';
  const amountCents = typeof body.amount_cents === 'number' ? Math.round(body.amount_cents) : NaN;
  const successUrl = typeof body.success_url === 'string' ? body.success_url.trim() : '';
  const cancelUrl = typeof body.cancel_url === 'string' ? body.cancel_url.trim() : '';

  if (!founderSlug || !founderName || !donorEmail || !Number.isInteger(amountCents) || !successUrl || !cancelUrl) {
    return null;
  }

  if (!isValidEmail(donorEmail) || !isValidUrl(successUrl) || !isValidUrl(cancelUrl)) {
    return null;
  }

  if (amountCents < 100 || amountCents > 100000) {
    return null;
  }

  return {
    founder_slug: founderSlug,
    founder_name: founderName,
    founder_id: founderId,
    donor_email: donorEmail,
    amount_cents: amountCents,
    success_url: successUrl,
    cancel_url: cancelUrl,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid JSON body.',
      },
      { status: 400 }
    );
  }

  const payload = validatePayload(body);
  if (!payload) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Body must include founder_slug, founder_name, donor_email, amount_cents (100-100000), success_url, and cancel_url.',
      },
      { status: 400 }
    );
  }

  if (DEMO_MODE) {
    const redirect = new URL(payload.success_url);
    redirect.searchParams.set('support', 'success');
    redirect.searchParams.set('demo', '1');
    redirect.searchParams.set('amount_cents', String(payload.amount_cents));
    return NextResponse.json(
      {
        success: true,
        sessionId: `demo-founder-support-${payload.founder_slug}`,
        checkoutUrl: redirect.toString(),
      },
      { status: 200 }
    );
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: payload.donor_email,
      success_url: payload.success_url,
      cancel_url: payload.cancel_url,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: payload.amount_cents,
            product_data: {
              name: `Support ${payload.founder_name}`,
              description: `One-time contribution for ${payload.founder_name}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: 'founder_support',
        founder_slug: payload.founder_slug,
        founder_name: payload.founder_name,
        founder_id: payload.founder_id ?? '',
        donor_email: payload.donor_email,
      },
      payment_intent_data: {
        metadata: {
          kind: 'founder_support',
          founder_slug: payload.founder_slug,
          founder_name: payload.founder_name,
          founder_id: payload.founder_id ?? '',
          donor_email: payload.donor_email,
        },
        receipt_email: payload.donor_email,
      },
    });

    return NextResponse.json(
      {
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create founder support checkout session.',
      },
      { status: 500 }
    );
  }
}
