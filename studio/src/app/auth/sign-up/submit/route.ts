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
import { getRuntimeEnv, getSupabaseConfigStatus, isDemoModeEnabled } from '@/src/lib/config/env';
import { getSupabaseClient } from '@/src/lib/db/client';
import { auditLog } from '@/src/lib/audit/log';

const POST_REDIRECT_STATUS = 303;

interface SupabaseSignUpResponse {
  access_token?: string;
  error_code?: string;
  msg?: string;
  message?: string;
  user?: {
    id?: string;
    email?: string;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
  };
}

interface SupabaseSignUpResult {
  ok: boolean;
  payload: SupabaseSignUpResponse | null;
}

interface SupabaseAdminUser {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}

interface SupabaseAdminUsersResponse {
  users?: SupabaseAdminUser[];
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

function redirectWithSuccess(request: NextRequest, nextPath: string, success: string): NextResponse {
  const url = new URL('/auth/sign-up', request.url);
  url.searchParams.set('next', sanitizeNextPath(nextPath));
  url.searchParams.set('success', success);
  return NextResponse.redirect(url, POST_REDIRECT_STATUS);
}

async function signUpWithSupabase(
  email: string,
  password: string,
  name: string,
  role: SignUpRole
): Promise<SupabaseSignUpResult> {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseAnonKey) {
    return { ok: false, payload: null };
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
      data: {
        name,
        role,
      },
    }),
  });

  const payload = await response.json().catch(() => null) as SupabaseSignUpResponse | null;
  return {
    ok: response.ok,
    payload,
  };
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

async function getSupabaseAuthUserByEmail(email: string): Promise<SupabaseAdminUser | null> {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseServiceRoleKey) {
    return null;
  }

  const response = await fetch(`${runtimeEnv.supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      apikey: runtimeEnv.supabaseServiceRoleKey,
      Authorization: `Bearer ${runtimeEnv.supabaseServiceRoleKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as SupabaseAdminUsersResponse;
  const normalizedEmail = email.trim().toLowerCase();

  return payload.users?.find((user) => user.email?.trim().toLowerCase() === normalizedEmail) ?? null;
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

  if (!getSupabaseConfigStatus().configured) {
    return redirectWithError(request, nextPath, 'supabase_not_configured');
  }

  const signUpResult = await signUpWithSupabase(email, password, name, role);
  let accessToken = signUpResult.ok ? signUpResult.payload?.access_token?.trim() || null : null;
  let verifiedAccessTokenPayload = accessToken ? await verifyJWT(accessToken) : null;
  let authUserId = signUpResult.ok ? signUpResult.payload?.user?.id?.trim() || verifiedAccessTokenPayload?.sub || null : null;
  let authEmail = signUpResult.ok
    ? signUpResult.payload?.user?.email?.trim().toLowerCase() || verifiedAccessTokenPayload?.email?.trim().toLowerCase() || null
    : null;
  let authUserConfirmed = Boolean(
    verifiedAccessTokenPayload?.email_confirmed_at
    || signUpResult.payload?.user?.email_confirmed_at
    || signUpResult.payload?.user?.confirmed_at
  );

  if (!authUserId || !authEmail || !accessToken) {
    const existingAccessToken = await signInWithSupabaseCredentials(email, password);
    if (existingAccessToken) {
      const payload = await verifyJWT(existingAccessToken);
      if (payload?.sub && payload.email) {
        accessToken = existingAccessToken;
        verifiedAccessTokenPayload = payload;
        authUserId = payload.sub;
        authEmail = payload.email.trim().toLowerCase();
        authUserConfirmed = Boolean(payload.email_confirmed_at);
      }
    }
  }

  if (!authUserId || !authEmail) {
    const existingAuthUser = await getSupabaseAuthUserByEmail(email);
    if (existingAuthUser?.id && existingAuthUser.email) {
      authUserId = existingAuthUser.id.trim();
      authEmail = existingAuthUser.email.trim().toLowerCase();
      authUserConfirmed = Boolean(existingAuthUser.email_confirmed_at || existingAuthUser.confirmed_at);
    }
  }

  if (!authUserId || !authEmail) {
    if (signUpResult.payload?.error_code === 'over_email_send_rate_limit') {
      return redirectWithError(request, nextPath, 'email_rate_limited');
    }
    return redirectWithError(request, nextPath, 'registration_failed');
  }
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

  if (!accessToken) {
    if (authUserConfirmed) {
      return redirectWithError(request, nextPath, 'session_failure');
    }
    return redirectWithSuccess(request, nextPath, 'confirm_email');
  }

  const payload = verifiedAccessTokenPayload ?? await verifyJWT(accessToken);
  if (!payload?.sub || !payload.email) {
    return redirectWithError(request, nextPath, 'session_failure');
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), POST_REDIRECT_STATUS);
  setAccessTokenCookie(response, accessToken);
  return response;
}
