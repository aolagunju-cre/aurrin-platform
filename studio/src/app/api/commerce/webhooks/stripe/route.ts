import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhookEvent } from '../../../../../lib/payments/webhook-handler';
import { getStripeClient, getStripeEnv } from '../../../../../lib/payments/stripe-client';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get('stripe-signature');
  const payload = await request.text();

  if (!signature) {
    return NextResponse.json({ success: false, message: 'Invalid Stripe signature.' }, { status: 403 });
  }

  let event;
  try {
    const stripe = getStripeClient();
    const { webhookSecret } = getStripeEnv();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid Stripe signature.' }, { status: 403 });
  }

  const result = await handleStripeWebhookEvent(event);
  return NextResponse.json({ received: true, ...result }, { status: 200 });
}
