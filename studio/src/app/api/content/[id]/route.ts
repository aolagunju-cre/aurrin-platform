import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';
import { hasEntitlement } from '../../../../lib/payments/entitlements';
import { resolveAuthIdentityFromRequest } from '../../../../lib/auth/request-auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const client = getSupabaseClient();
  const contentResult = await client.db.getContentById(id);

  if (contentResult.error) {
    return NextResponse.json({ success: false, message: 'Could not load content' }, { status: 500 });
  }
  if (!contentResult.data) {
    return NextResponse.json({ success: false, message: 'Content not found' }, { status: 404 });
  }

  const content = contentResult.data;
  if (content.requires_subscription) {
    const identity = await resolveAuthIdentityFromRequest(request);

    if (!identity?.userId || !content.product_id) {
      return NextResponse.json({ success: false, message: 'Subscription required' }, { status: 403 });
    }

    const entitled = await hasEntitlement(identity.userId, content.product_id);
    if (!entitled) {
      return NextResponse.json({ success: false, message: 'Subscription required' }, { status: 403 });
    }
  }

  return NextResponse.json({ success: true, data: content }, { status: 200 });
}
