import { NextRequest, NextResponse } from 'next/server';
import { verifyAndApplyUnsubscribe } from '../../../lib/email/unsubscribe';

interface UnsubscribeBody {
  token?: string;
  email?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: UnsubscribeBody;
  try {
    body = (await request.json()) as UnsubscribeBody;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!token || !email) {
    return NextResponse.json(
      { success: false, message: 'token and email are required' },
      { status: 400 }
    );
  }

  const unsubscribed = await verifyAndApplyUnsubscribe(token, email);
  if (!unsubscribed) {
    return NextResponse.json(
      { success: false, message: 'Invalid unsubscribe token or email' },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, message: 'You have been unsubscribed' }, { status: 200 });
}
