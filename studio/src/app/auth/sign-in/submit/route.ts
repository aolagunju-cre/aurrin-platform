import { NextRequest, NextResponse } from 'next/server';
import {
  createDemoSessionToken,
  isDemoPersona,
  sanitizeNextPath,
  setAccessTokenCookie,
  setDemoSessionCookie,
} from '@/src/lib/auth/request-auth';
import { isDemoModeEnabled } from '@/src/lib/config/env';
import { verifyJWT } from '@/src/lib/auth/jwt';

const POST_REDIRECT_STATUS = 303;

function redirectWithError(request: NextRequest, nextPath: string, error: string): NextResponse {
  const url = new URL('/auth/sign-in', request.url);
  url.searchParams.set('next', sanitizeNextPath(nextPath));
  url.searchParams.set('error', error);
  return NextResponse.redirect(url, POST_REDIRECT_STATUS);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const mode = String(formData.get('mode') ?? '').trim();
  const nextPath = sanitizeNextPath(String(formData.get('next') ?? '/'));

  if (mode === 'demo') {
    if (!isDemoModeEnabled()) {
      return redirectWithError(request, nextPath, 'forbidden');
    }

    const persona = String(formData.get('persona') ?? '').trim();
    if (!isDemoPersona(persona)) {
      return redirectWithError(request, nextPath, 'forbidden');
    }

    try {
      const token = await createDemoSessionToken(persona);
      const response = NextResponse.redirect(new URL(nextPath, request.url), POST_REDIRECT_STATUS);
      setDemoSessionCookie(response, token);
      return response;
    } catch {
      return redirectWithError(request, nextPath, 'forbidden');
    }
  }

  const accessToken = String(formData.get('access_token') ?? '').trim();
  if (!accessToken) {
    return redirectWithError(request, nextPath, 'invalid_token');
  }

  const payload = await verifyJWT(accessToken);
  if (!payload?.sub || !payload.email) {
    return redirectWithError(request, nextPath, 'invalid_token');
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), POST_REDIRECT_STATUS);
  setAccessTokenCookie(response, accessToken);
  return response;
}
