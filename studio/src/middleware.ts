import { NextRequest, NextResponse } from 'next/server';
import {
  buildSignInUrl,
  getRoleAssignmentsForUser,
  hasNormalizedRole,
  resolveAuthIdentityFromRequest,
  type NormalizedRole,
} from './lib/auth/request-auth';

// Trailing slashes are required so path prefixes match as directory prefixes
// only. Without them, `/founder` matches both `/founder/dashboard` (protected)
// and `/founders/[slug]` (public donor-facing profile), which broke the PR #263
// public founder profile page in production.
const PUBLIC_PATHS = ['/public/', '/api/public/', '/auth/'];
const PROTECTED_PAGE_PATHS = ['/admin/', '/judge/', '/founder/', '/mentor/', '/subscriber/'];
const PROTECTED_API_PATHS = ['/api/admin/', '/api/judge/', '/api/founder/', '/api/mentor/', '/api/subscriber/', '/api/protected/'];

const DEMO_ROLE_RULES: Array<{ prefixes: string[]; role: NormalizedRole }> = [
  { prefixes: ['/admin/', '/api/admin/'], role: 'admin' },
  { prefixes: ['/judge/', '/api/judge/'], role: 'judge' },
  { prefixes: ['/founder/', '/api/founder/'], role: 'founder' },
  { prefixes: ['/mentor/', '/api/mentor/'], role: 'mentor' },
  { prefixes: ['/subscriber/', '/api/subscriber/'], role: 'subscriber' },
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

function getRequiredDemoRole(pathname: string): NormalizedRole | null {
  const rule = DEMO_ROLE_RULES.find((entry) => matchesPrefix(pathname, entry.prefixes));
  return rule?.role ?? null;
}

function jsonAuthError(status: 401 | 403, requestId: string, message: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get('x-request-id') ?? globalThis.crypto.randomUUID();

  if (matchesPrefix(pathname, PUBLIC_PATHS)) {
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const isProtectedPage = matchesPrefix(pathname, PROTECTED_PAGE_PATHS);
  const isProtectedApi = matchesPrefix(pathname, PROTECTED_API_PATHS);
  if (!isProtectedPage && !isProtectedApi) {
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const identity = await resolveAuthIdentityFromRequest(request);
  if (!identity) {
    if (isProtectedApi) {
      return jsonAuthError(401, requestId, 'Unauthorized');
    }

    const response = NextResponse.redirect(buildSignInUrl(request, 'unauthorized'));
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const requiredRole = getRequiredDemoRole(pathname);
  if (requiredRole) {
    const granted = identity.demoSession
      ? hasNormalizedRole(identity.demoSession.roles, requiredRole)
      : hasNormalizedRole((await getRoleAssignmentsForUser(identity.userId))?.map((assignment) => assignment.role) ?? [], requiredRole);

    if (!granted) {
      if (isProtectedApi) {
        return jsonAuthError(403, requestId, 'Forbidden');
      }

      const response = NextResponse.redirect(buildSignInUrl(request, 'forbidden'));
      response.headers.set('x-request-id', requestId);
      return response;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-user-id', identity.userId);
  requestHeaders.set('x-user-email', identity.email);
  requestHeaders.set('x-auth-kind', identity.kind);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
