import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/src/lib/auth/jwt';
import {
  createDemoRegistrationSessionToken,
  normalizeSignUpRole,
  sanitizeNextPath,
  setAccessTokenCookie,
  setDemoSessionCookie,
  type SignUpRole,
} from '@/src/lib/auth/request-auth';
import { getRuntimeEnv, isDemoModeEnabled } from '@/src/lib/config/env';
import { getSupabaseClient } from '@/src/lib/db/client';
import { auditLog } from '@/src/lib/audit/log';

const POST_REDIRECT_STATUS = 303;

interface SupabaseSignUpResponse {
  access_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
}

function roleLandingPath(role: SignUpRole): string {
  if (role === 'founder') {
    return '/founder';
  }
  if (role === 'judge') {
    return '/judge/events';
  }
  if (role === 'mentor') {
    return '/mentor';
  }
  return '/subscriber';
}

function redirectWithError(request: NextRequest, nextPath: string, error: string): NextResponse {
  const url = new URL('/auth/sign-up', request.url);
  url.searchParams.set('next', sanitizeNextPath(nextPath));
  url.searchParams.set('error', error);
  return NextResponse.redirect(url, POST_REDIRECT_STATUS);
}

async function signUpWithSupabase(email: string, password: string, name: string): Promise<SupabaseSignUpResponse | null> {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseAnonKey) {
    return null;
  }

  const response = await fetch(`${runtimeEnv.supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: runtimeEnv.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      data: { name },
    }),
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<SupabaseSignUpResponse>;
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const mode = String(formData.get('mode') ?? '').trim();
  const requestedNextPath = String(formData.get('next') ?? '').trim();
  const selectedRole = String(formData.get('role') ?? '').trim();
  const role = normalizeSignUpRole(selectedRole);
  const fallbackNextPath = role ? roleLandingPath(role) : '/';
  const nextPath = sanitizeNextPath(requestedNextPath || fallbackNextPath);

  if (!role) {
    return redirectWithError(request, nextPath, 'invalid_role');
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!email || !password) {
    return redirectWithError(request, nextPath, 'invalid_credentials');
  }

  if (mode === 'demo') {
    if (!isDemoModeEnabled()) {
      return redirectWithError(request, nextPath, 'forbidden');
    }

    try {
      const token = await createDemoRegistrationSessionToken({ role, email, name });
      const response = NextResponse.redirect(new URL(nextPath, request.url), POST_REDIRECT_STATUS);
      setDemoSessionCookie(response, token);
      return response;
    } catch {
      return redirectWithError(request, nextPath, 'registration_failed');
    }
  }

  const signUpPayload = await signUpWithSupabase(email, password, name);
  if (!signUpPayload?.user?.id || !signUpPayload.user.email) {
    return redirectWithError(request, nextPath, 'registration_failed');
  }

  const authUserId = signUpPayload.user.id;
  const authEmail = signUpPayload.user.email.trim().toLowerCase();
  const client = getSupabaseClient();

  const existingUserResult = await client.db.getUserByEmail(authEmail);
  if (existingUserResult.error) {
    return redirectWithError(request, nextPath, 'registration_failed');
  }

  let appUser = existingUserResult.data;
  if (!appUser) {
    const insertUserResult = await client.db.insertUser({
      id: authUserId,
      email: authEmail,
      name: name || null,
    });
    if (insertUserResult.error || !insertUserResult.data) {
      return redirectWithError(request, nextPath, 'registration_failed');
    }
    appUser = insertUserResult.data;
  } else if (name && appUser.name !== name) {
    await client.db.updateUser(appUser.id, { name });
  }

  const roleAssignmentsResult = await client.db.getRoleAssignmentsByUserId(appUser.id);
  if (roleAssignmentsResult.error) {
    return redirectWithError(request, nextPath, 'registration_failed');
  }

  const hasRoleAssignment = roleAssignmentsResult.data.some((assignment) =>
    assignment.role === role && assignment.scope === 'global' && assignment.scoped_id === null
  );

  if (!hasRoleAssignment) {
    const insertRoleResult = await client.db.insertRoleAssignment({
      user_id: appUser.id,
      role,
      scope: 'global',
      scoped_id: null,
      created_by: appUser.id,
    });
    if (insertRoleResult.error || !insertRoleResult.data) {
      return redirectWithError(request, nextPath, 'registration_failed');
    }

    await auditLog(
      'role_assigned',
      appUser.id,
      {
        resource_type: 'role_assignment',
        resource_id: insertRoleResult.data.id,
        changes: {
          before: null,
          after: insertRoleResult.data,
        },
      },
      { request_id: request.headers.get('x-request-id') ?? undefined }
    );
  }

  const accessToken = signUpPayload.access_token?.trim() || await signInWithSupabaseCredentials(email, password);
  if (!accessToken) {
    return redirectWithError(request, nextPath, 'session_failure');
  }

  const payload = await verifyJWT(accessToken);
  if (!payload?.sub || !payload.email) {
    return redirectWithError(request, nextPath, 'session_failure');
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), POST_REDIRECT_STATUS);
  setAccessTokenCookie(response, accessToken);
  return response;
}
