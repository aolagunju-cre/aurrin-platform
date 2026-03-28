import { NextRequest, NextResponse } from 'next/server';
import {
  createDemoSessionToken,
  isDemoPersona,
  resolvePrimaryPortalPathFromAssignments,
  sanitizeNextPath,
  setAccessTokenCookie,
  setDemoSessionCookie,
} from '@/src/lib/auth/request-auth';
import { getRuntimeEnv, getSupabaseConfigStatus, isDemoModeEnabled } from '@/src/lib/config/env';
import { verifyJWT } from '@/src/lib/auth/jwt';
import { getSupabaseClient } from '@/src/lib/db/client';

const POST_REDIRECT_STATUS = 303;

function redirectWithError(request: NextRequest, nextPath: string, error: string): NextResponse {
  const url = new URL('/auth/sign-in', request.url);
  url.searchParams.set('next', sanitizeNextPath(nextPath));
  url.searchParams.set('error', error);
  return NextResponse.redirect(url, POST_REDIRECT_STATUS);
}

async function signInWithSupabaseCredentials(email: string, password: string): Promise<string | null> {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseAnonKey) {
    return null;
  }

  const response = await fetch(`${runtimeEnv.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: runtimeEnv.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as { access_token?: string };
  return payload.access_token?.trim() || null;
}

async function resolvePostLoginDestination(nextPath: string, userId: string): Promise<string | null> {
  if (nextPath !== '/') {
    return nextPath;
  }

  const roleAssignmentsResult = await getSupabaseClient().db.getRoleAssignmentsByUserId(userId);
  if (roleAssignmentsResult.error) {
    return null;
  }

  return resolvePrimaryPortalPathFromAssignments(roleAssignmentsResult.data);
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

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  if (!email || !password) {
    return redirectWithError(request, nextPath, 'invalid_credentials');
  }

  if (!getSupabaseConfigStatus().configured) {
    return redirectWithError(request, nextPath, 'supabase_not_configured');
  }

  const accessToken = await signInWithSupabaseCredentials(email, password);
  if (!accessToken) {
    return redirectWithError(request, nextPath, 'invalid_credentials');
  }

  const payload = await verifyJWT(accessToken);
  if (!payload?.sub || !payload.email) {
    return redirectWithError(request, nextPath, 'session_failure');
  }

  const destinationPath = await resolvePostLoginDestination(nextPath, payload.sub);
  if (!destinationPath) {
    return redirectWithError(request, nextPath, 'forbidden');
  }

  const response = NextResponse.redirect(new URL(destinationPath, request.url), POST_REDIRECT_STATUS);
  setAccessTokenCookie(response, accessToken);
  return response;
}
