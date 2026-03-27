import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { getStripeClient } from '../../../../../../lib/payments/stripe-client';
import { requireSubscriber } from '../../../../../../lib/auth/subscriber';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireSubscriber(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (DEMO_MODE) {
    const { id } = await context.params;
    return NextResponse.json(
      {
        success: true,
        data: {
          url: `${new URL(request.url).origin}/subscriber?demoPortal=${encodeURIComponent(id)}`,
        },
      },
      { status: 200 }
    );
  }

  const { id } = await context.params;
  const subscription = await getSupabaseClient().db.getSubscriptionById(id);
  if (subscription.error) {
    return NextResponse.json({ success: false, message: 'Could not load subscription' }, { status: 500 });
  }
  if (!subscription.data) {
    return NextResponse.json({ success: false, message: 'Subscription not found' }, { status: 404 });
  }
  if (subscription.data.user_id !== auth.userId) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }
  if (!subscription.data.stripe_customer_id) {
    return NextResponse.json({ success: false, message: 'No Stripe customer is linked for this subscription' }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.data.stripe_customer_id,
      return_url: `${origin}/subscriber`,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          url: session.url,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ success: false, message: 'Could not create customer portal link' }, { status: 500 });
  }
}
