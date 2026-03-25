import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, extractTokenFromHeader, isTokenExpired } from './lib/auth/jwt';
import { randomUUID } from 'crypto';

const PUBLIC_PATHS = ['/public', '/api/public'];
const PROTECTED_PATHS = ['/admin', '/judge', '/founder', '/mentor', '/subscriber', '/api/protected'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a request ID for tracing; preserve if already set by upstream
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  const baseHeaders = new Headers(request.headers);
  baseHeaders.set('x-request-id', requestId);

  // Allow public paths without authentication
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next({ request: { headers: baseHeaders } });
    response.headers.set('x-request-id', requestId);
    return response;
  }

  // Check if path requires authentication
  const requiresAuth = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (requiresAuth) {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
      });
    }

    const payload = await verifyJWT(token);

    if (!payload) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
      });
    }

    if (isTokenExpired(payload)) {
      return new NextResponse(JSON.stringify({ error: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
      });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-email', payload.email);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const response = NextResponse.next({ request: { headers: baseHeaders } });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
