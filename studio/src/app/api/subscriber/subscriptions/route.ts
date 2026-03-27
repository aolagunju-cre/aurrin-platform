import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoSubscriptions } from '@/src/lib/demo/data';
import { getSupabaseClient } from '../../../../lib/db/client';
import { requireSubscriber } from '../../../../lib/auth/subscriber';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireSubscriber(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (DEMO_MODE) {
    return NextResponse.json(
      {
        success: true,
        data: demoSubscriptions.map((subscription, index) => ({
          id: subscription.id,
          price_id: `demo-price-${index + 1}`,
          status: subscription.status,
          current_period_end: subscription.current_period_end,
          stripe_customer_id: `demo-customer-${index + 1}`,
        })),
      },
      { status: 200 }
    );
  }

  const result = await getSupabaseClient().db.listSubscriptionsByUserId(auth.userId);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Could not load subscriptions' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}
