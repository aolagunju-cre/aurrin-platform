import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthIdentityFromRequest } from './request-auth';

export interface SubscriberContext {
  userId: string;
  email: string;
}

interface SubscriberAuthResult {
  ok: boolean;
  status?: 401;
  message?: string;
  context?: SubscriberContext;
}

export async function verifySubscriberFromRequest(request: NextRequest): Promise<SubscriberAuthResult> {
  const identity = await resolveAuthIdentityFromRequest(request);
  if (!identity) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  return {
    ok: true,
    context: {
      userId: identity.userId,
      email: identity.email,
    },
  };
}

export async function requireSubscriber(request: NextRequest): Promise<SubscriberContext | NextResponse> {
  const authResult = await verifySubscriberFromRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as SubscriberContext;
}
