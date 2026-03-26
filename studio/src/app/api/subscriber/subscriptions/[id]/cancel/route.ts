import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyJWT } from '../../../../../../lib/auth/jwt';
import { getSupabaseClient } from '../../../../../../lib/db/client';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const token = extractTokenFromHeader(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const auth = await verifyJWT(token);
  if (!auth?.sub) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
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
  if (subscriptionResult.data.user_id !== auth.sub) {
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
