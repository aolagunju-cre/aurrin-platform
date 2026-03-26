import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyJWT } from '../../../../lib/auth/jwt';
import { getSupabaseClient } from '../../../../lib/db/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = extractTokenFromHeader(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const auth = await verifyJWT(token);
  if (!auth?.sub) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const result = await getSupabaseClient().db.listSubscriptionsByUserId(auth.sub);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Could not load subscriptions' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}
