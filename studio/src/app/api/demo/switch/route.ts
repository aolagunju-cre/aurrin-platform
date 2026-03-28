import { NextRequest, NextResponse } from 'next/server';
import {
  createDemoSessionToken,
  isDemoPersona,
  setDemoSessionCookie,
} from '@/src/lib/auth/request-auth';
import { isDemoModeEnabled } from '@/src/lib/config/env';

const PORTAL_PATH: Record<string, string> = {
  admin: '/admin',
  judge: '/judge/events',
  founder: '/founder',
  mentor: '/mentor',
  subscriber: '/subscriber',
  audience: '/',
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const persona = request.nextUrl.searchParams.get('persona')?.trim() ?? '';

  if (!isDemoModeEnabled() || !isDemoPersona(persona)) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  const token = await createDemoSessionToken(persona);
  const destination = PORTAL_PATH[persona] ?? '/';
  const response = NextResponse.redirect(new URL(destination, request.url));
  setDemoSessionCookie(response, token);
  return response;
}
