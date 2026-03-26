import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyJWT } from '../../../../lib/auth/jwt';
import { getSupabaseClient } from '../../../../lib/db/client';
import { hasEntitlement } from '../../../../lib/payments/entitlements';

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
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    const auth = token ? await verifyJWT(token) : null;

    if (!auth?.sub || !content.product_id) {
      return NextResponse.json({ success: false, message: 'Subscription required' }, { status: 403 });
    }

    const entitled = await hasEntitlement(auth.sub, content.product_id);
    if (!entitled) {
      return NextResponse.json({ success: false, message: 'Subscription required' }, { status: 403 });
    }
  }

  return NextResponse.json({ success: true, data: content }, { status: 200 });
}
