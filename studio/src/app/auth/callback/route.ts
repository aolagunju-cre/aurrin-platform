import { NextRequest, NextResponse } from 'next/server';
import { sanitizeNextPath, setAccessTokenCookie } from '@/src/lib/auth/request-auth';
import { verifyJWT } from '@/src/lib/auth/jwt';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.nextUrl.searchParams.get('access_token')?.trim()
    ?? request.nextUrl.searchParams.get('token')?.trim()
    ?? '';
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next'));

  if (!accessToken) {
    const url = new URL('/auth/sign-in', request.url);
    url.searchParams.set('next', nextPath);
    url.searchParams.set('error', 'invalid_token');
    return NextResponse.redirect(url);
  }

  const payload = await verifyJWT(accessToken);
  if (!payload?.sub || !payload.email) {
    const url = new URL('/auth/sign-in', request.url);
    url.searchParams.set('next', nextPath);
    url.searchParams.set('error', 'invalid_token');
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  setAccessTokenCookie(response, accessToken);
  return response;
}
