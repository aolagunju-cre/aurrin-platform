import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, type RoleAssignmentRecord } from '../db/client';
import { extractTokenFromHeader, type JWTPayload, verifyJWT } from './jwt';

export interface MentorAuthContext {
  userId: string;
  auth: JWTPayload;
  roleAssignments: RoleAssignmentRecord[];
}

interface MentorAuthResult {
  ok: boolean;
  status?: 401 | 403 | 500;
  message?: string;
  context?: MentorAuthContext;
}

export function hasMentorRole(roleAssignments: RoleAssignmentRecord[]): boolean {
  return roleAssignments.some(
    (assignment) => assignment.role === 'mentor' && (assignment.scope === 'global' || assignment.scope === 'event')
  );
}

export function canAccessMentorEvent(roleAssignments: RoleAssignmentRecord[], eventId: string | null): boolean {
  if (!eventId) {
    return true;
  }
  return roleAssignments.some(
    (assignment) =>
      assignment.role === 'mentor' &&
      (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
  );
}

export async function verifyMentorFromAuthHeader(authHeader: string | null): Promise<MentorAuthResult> {
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
    return { ok: false, status: 500, message: 'Could not verify mentor authorization' };
  }

  if (!hasMentorRole(rolesResult.data)) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  return {
    ok: true,
    context: {
      userId: auth.sub,
      auth,
      roleAssignments: rolesResult.data,
    },
  };
}

export async function requireMentor(request: NextRequest): Promise<MentorAuthContext | NextResponse> {
  const authResult = await verifyMentorFromAuthHeader(request.headers.get('authorization'));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as MentorAuthContext;
}
