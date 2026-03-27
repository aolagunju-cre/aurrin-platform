import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, type RoleAssignmentRecord } from '../db/client';
import { extractTokenFromHeader, type JWTPayload, verifyJWT } from './jwt';

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

export async function verifyJudgeFromAuthHeader(authHeader: string | null): Promise<JudgeAuthResult> {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const auth = await verifyJWT(token);
  if (!auth?.sub) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const client = getSupabaseClient();
  const rolesResult = await client.db.getRoleAssignmentsByUserId(auth.sub);
  if (rolesResult.error) {
    return { ok: false, status: 500, message: 'Could not verify judge authorization' };
  }

  const roleAssignments = rolesResult.data;
  const hasJudgeRole = roleAssignments.some(
    (assignment) =>
      assignment.role === 'judge' && (assignment.scope === 'global' || assignment.scope === 'event')
  );

  if (!hasJudgeRole) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  return {
    ok: true,
    context: {
      userId: auth.sub,
      auth,
      roleAssignments,
    },
  };
}

export async function requireJudge(request: NextRequest): Promise<JudgeContext | NextResponse> {
  const authResult = await verifyJudgeFromAuthHeader(request.headers.get('authorization'));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as JudgeContext;
}

export function canAccessEvent(roleAssignments: RoleAssignmentRecord[], eventId: string): boolean {
  return roleAssignments.some(
    (assignment) =>
      assignment.role === 'judge' &&
      (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
  );
}
