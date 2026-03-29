import { NextRequest, NextResponse } from 'next/server';
import {
  createDemoSessionToken,
  isDemoPersona,
  normalizeSignUpRole,
  resolvePrimaryPortalPathFromAssignments,
  sanitizeNextPath,
  setAccessTokenCookie,
  setDemoSessionCookie,
  type SignUpRole,
} from '@/src/lib/auth/request-auth';
import { getRuntimeEnv, getSupabaseConfigStatus, isDemoModeEnabled } from '@/src/lib/config/env';
import { verifyJWT, type JWTPayload } from '@/src/lib/auth/jwt';
import { getSupabaseClient, type RoleAssignmentRecord } from '@/src/lib/db/client';

const POST_REDIRECT_STATUS = 303;
const PROTECTED_PORTAL_PREFIXES = ['/admin', '/judge', '/founder', '/mentor', '/subscriber'] as const;

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

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readMetadataStringArray(
  metadata: Record<string, unknown> | undefined,
  key: string
): string[] {
  const value = metadata?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function extractProvisionableRoles(payload: JWTPayload): SignUpRole[] {
  const roles = new Set<SignUpRole>();
  const addRole = (value: unknown) => {
    if (typeof value !== 'string') {
      return;
    }

    const role = normalizeSignUpRole(value);
    if (role) {
      roles.add(role);
    }
  };

  addRole(readMetadataString(payload.user_metadata, 'role'));
  addRole(readMetadataString(payload.app_metadata, 'role'));

  for (const role of readMetadataStringArray(payload.user_metadata, 'roles')) {
    addRole(role);
  }

  for (const role of readMetadataStringArray(payload.app_metadata, 'roles')) {
    addRole(role);
  }

  return Array.from(roles);
}

function extractAuthName(payload: JWTPayload): string | null {
  return readMetadataString(payload.user_metadata, 'name')
    ?? readMetadataString(payload.app_metadata, 'name');
}

function isProtectedPortalPath(nextPath: string): boolean {
  return PROTECTED_PORTAL_PREFIXES.some((prefix) => nextPath === prefix || nextPath.startsWith(`${prefix}/`));
}

async function ensureLoginProvisioning(payload: JWTPayload): Promise<RoleAssignmentRecord[] | null> {
  const client = getSupabaseClient();
  const roleAssignmentsResult = await client.db.getRoleAssignmentsByUserId(payload.sub);
  if (roleAssignmentsResult.error) {
    return null;
  }

  let roleAssignments = roleAssignmentsResult.data;
  if (roleAssignments.length > 0) {
    return roleAssignments;
  }

  const rolesToProvision = extractProvisionableRoles(payload);
  if (rolesToProvision.length === 0) {
    return [];
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const existingUserResult = await client.db.getUserByEmail(normalizedEmail);
  if (existingUserResult.error) {
    return null;
  }

  const existingUser = existingUserResult.data;
  const name = extractAuthName(payload);

  if (existingUser && existingUser.id !== payload.sub) {
    return null;
  }

  if (!existingUser) {
    const insertUserResult = await client.db.insertUser({
      id: payload.sub,
      email: normalizedEmail,
      name,
    });
    if (insertUserResult.error || !insertUserResult.data) {
      return null;
    }
  } else if (name && existingUser.name !== name) {
    await client.db.updateUser(existingUser.id, { name });
  }

  for (const role of rolesToProvision) {
    const hasRole = roleAssignments.some((assignment) =>
      assignment.role === role && assignment.scope === 'global' && assignment.scoped_id === null
    );
    if (hasRole) {
      continue;
    }

    const insertRoleResult = await client.db.insertRoleAssignment({
      user_id: payload.sub,
      role,
      scope: 'global',
      scoped_id: null,
      created_by: payload.sub,
    });

    if (insertRoleResult.error || !insertRoleResult.data) {
      const refreshedRoleAssignments = await client.db.getRoleAssignmentsByUserId(payload.sub);
      if (refreshedRoleAssignments.error) {
        return null;
      }

      roleAssignments = refreshedRoleAssignments.data;
      const recoveredRole = roleAssignments.some((assignment) =>
        assignment.role === role && assignment.scope === 'global' && assignment.scoped_id === null
      );
      if (!recoveredRole) {
        return null;
      }
      continue;
    }

    roleAssignments = [...roleAssignments, insertRoleResult.data];
  }

  return roleAssignments;
}

async function resolvePostLoginDestination(
  nextPath: string,
  payload: JWTPayload
): Promise<{ destinationPath: string | null; roleAssignments: RoleAssignmentRecord[] | null }> {
  const roleAssignments = await ensureLoginProvisioning(payload);
  if (roleAssignments === null) {
    return { destinationPath: null, roleAssignments: null };
  }

  if (nextPath !== '/') {
    if (isProtectedPortalPath(nextPath) && roleAssignments.length === 0) {
      return { destinationPath: null, roleAssignments };
    }

    return { destinationPath: nextPath, roleAssignments };
  }

  return {
    destinationPath: resolvePrimaryPortalPathFromAssignments(roleAssignments),
    roleAssignments,
  };
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

  const { destinationPath, roleAssignments } = await resolvePostLoginDestination(nextPath, payload);
  if (roleAssignments === null) {
    return redirectWithError(request, nextPath, 'session_failure');
  }

  if (!destinationPath) {
    return redirectWithError(request, nextPath, 'forbidden');
  }

  const response = NextResponse.redirect(new URL(destinationPath, request.url), POST_REDIRECT_STATUS);
  setAccessTokenCookie(response, accessToken);
  return response;
}
