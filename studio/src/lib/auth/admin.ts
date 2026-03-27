import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, type RoleAssignmentRecord } from '../db/client';
import { type JWTPayload } from './jwt';
import {
  createDemoRoleAssignments,
  resolveAuthIdentityFromRequest,
  resolveAuthIdentityFromStores,
  toAuthPayload,
} from './request-auth';
import { resolveServerAuthIdentity } from './server-auth';

export interface AdminContext {
  userId: string;
  auth: JWTPayload;
  email: string;
  isDemo: boolean;
  roleAssignments: RoleAssignmentRecord[];
}

interface AdminAuthResult {
  ok: boolean;
  status?: 401 | 403 | 500;
  message?: string;
  context?: AdminContext;
}

function hasAdminRole(roleAssignments: RoleAssignmentRecord[]): boolean {
  return roleAssignments.some((assignment) => assignment.role.toLowerCase() === 'admin' && assignment.scope === 'global');
}

async function verifyAdminIdentity(
  identity: Awaited<ReturnType<typeof resolveAuthIdentityFromRequest>> | Awaited<ReturnType<typeof resolveServerAuthIdentity>>
): Promise<AdminAuthResult> {
  if (!identity) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const client = getSupabaseClient();
  const rolesResult = identity.demoSession
    ? { data: createDemoRoleAssignments(identity), error: null }
    : await client.db.getRoleAssignmentsByUserId(identity.userId);

  if (rolesResult.error) {
    return { ok: false, status: 500, message: 'Could not verify admin authorization' };
  }

  if (!hasAdminRole(rolesResult.data)) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  return {
    ok: true,
    context: {
      userId: identity.userId,
      auth: toAuthPayload(identity),
      email: identity.email,
      isDemo: Boolean(identity.demoSession),
      roleAssignments: rolesResult.data,
    },
  };
}

export async function verifyAdminFromAuthHeader(authHeader: string | null): Promise<AdminAuthResult> {
  const identity = await resolveAuthIdentityFromStores(
    {
      get(name: string) {
        if (name.toLowerCase() === 'authorization') {
          return authHeader;
        }
        return null;
      },
    },
    { get() { return undefined; } }
  );

  return verifyAdminIdentity(identity);
}

export async function verifyAdminForServerComponent(): Promise<AdminAuthResult> {
  return verifyAdminIdentity(await resolveServerAuthIdentity());
}

export async function requireAdmin(request: NextRequest): Promise<AdminContext | NextResponse> {
  const authResult = await verifyAdminIdentity(await resolveAuthIdentityFromRequest(request));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as AdminContext;
}
