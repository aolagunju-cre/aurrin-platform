import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, type RoleAssignmentRecord } from '../db/client';
import { type JWTPayload } from './jwt';
import { createDemoRoleAssignments, resolveAuthIdentityFromRequest, resolveAuthIdentityFromStores, toAuthPayload } from './request-auth';

export interface JudgeContext {
  userId: string;
  auth: JWTPayload;
  roleAssignments: RoleAssignmentRecord[];
}

interface JudgeAuthResult {
  ok: boolean;
  status?: 401 | 403 | 500;
  message?: string;
  context?: JudgeContext;
}

async function verifyJudgeIdentity(
  identity: Awaited<ReturnType<typeof resolveAuthIdentityFromRequest>>
): Promise<JudgeAuthResult> {
  if (!identity) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const client = getSupabaseClient();
  const rolesResult = identity.demoSession
    ? { data: createDemoRoleAssignments(identity), error: null }
    : await client.db.getRoleAssignmentsByUserId(identity.userId);
  if (rolesResult.error) {
    return { ok: false, status: 500, message: 'Could not verify judge authorization' };
  }

  const roleAssignments = rolesResult.data;
  const hasJudgeRole = roleAssignments.some(
    (assignment) =>
      assignment.role.toLowerCase() === 'judge' && (assignment.scope === 'global' || assignment.scope === 'event')
  );

  if (!hasJudgeRole) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  return {
    ok: true,
    context: {
      userId: identity.userId,
      auth: toAuthPayload(identity),
      roleAssignments,
    },
  };
}

export async function verifyJudgeFromAuthHeader(authHeader: string | null): Promise<JudgeAuthResult> {
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

  return verifyJudgeIdentity(identity);
}

export async function requireJudge(request: NextRequest): Promise<JudgeContext | NextResponse> {
  const authResult = await verifyJudgeIdentity(await resolveAuthIdentityFromRequest(request));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as JudgeContext;
}

export function canAccessEvent(roleAssignments: RoleAssignmentRecord[], eventId: string): boolean {
  return roleAssignments.some(
    (assignment) =>
      assignment.role.toLowerCase() === 'judge' &&
      (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
  );
}
