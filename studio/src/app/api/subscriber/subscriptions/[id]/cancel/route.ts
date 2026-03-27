import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { getSupabaseClient } from '../../../../../../lib/db/client';
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
          id,
          status: 'cancelled',
          cancel_at: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  }

  const { id } = await context.params;
  const client = getSupabaseClient();
  const subscriptionResult = await client.db.getSubscriptionById(id);

  if (subscriptionResult.error) {
    return NextResponse.json({ success: false, message: 'Could not load subscription' }, { status: 500 });
  }
  if (!subscriptionResult.data) {
    return NextResponse.json({ success: false, message: 'Subscription not found' }, { status: 404 });
  }
  if (subscriptionResult.data.user_id !== auth.userId) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }
  if (!subscriptionResult.data.stripe_subscription_id) {
    return NextResponse.json(
      { success: false, message: 'Cancellation is only supported for Stripe-managed subscriptions' },
      { status: 400 }
    );
  }

  const cancellationResult = await client.db.requestSubscriptionCancellation(id);
  if (cancellationResult.error || !cancellationResult.data) {
    return NextResponse.json({ success: false, message: 'Could not request cancellation' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        id: cancellationResult.data.id,
        status: cancellationResult.data.status,
        cancel_at: cancellationResult.data.cancel_at,
      },
    },
    { status: 200 }
  );
}
