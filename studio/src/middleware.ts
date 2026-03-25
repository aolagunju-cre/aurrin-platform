import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, extractTokenFromHeader, isTokenExpired } from './lib/auth/jwt';

const PUBLIC_PATHS = ['/public', '/api/public'];
const PROTECTED_PATHS = ['/admin', '/judge', '/founder', '/mentor', '/subscriber', '/api/protected'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without authentication
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if path requires authentication
  const requiresAuth = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (requiresAuth) {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    // No token provided
    if (!token) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify token
    const payload = await verifyJWT(token);

    // Invalid token
    if (!payload) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Token expired
    if (isTokenExpired(payload)) {
      return new NextResponse(JSON.stringify({ error: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clone the request and add user context
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-email', payload.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
