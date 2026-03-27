import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, type RoleAssignmentRecord } from '../db/client';
import { type JWTPayload } from './jwt';
import { createDemoRoleAssignments, resolveAuthIdentityFromRequest, resolveAuthIdentityFromStores, toAuthPayload } from './request-auth';

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
    (assignment) => assignment.role.toLowerCase() === 'mentor' && (assignment.scope === 'global' || assignment.scope === 'event')
  );
}

export function canAccessMentorEvent(roleAssignments: RoleAssignmentRecord[], eventId: string | null): boolean {
  if (!eventId) {
    return true;
  }

  return roleAssignments.some(
    (assignment) =>
      assignment.role.toLowerCase() === 'mentor' &&
      (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
  );
}

async function verifyMentorIdentity(
  identity: Awaited<ReturnType<typeof resolveAuthIdentityFromRequest>>
): Promise<MentorAuthResult> {
  if (!identity) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const client = getSupabaseClient();
  const rolesResult = identity.demoSession
    ? { data: createDemoRoleAssignments(identity), error: null }
    : await client.db.getRoleAssignmentsByUserId(identity.userId);
  if (rolesResult.error) {
    return { ok: false, status: 500, message: 'Could not verify mentor authorization' };
  }

  if (!hasMentorRole(rolesResult.data)) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  return {
    ok: true,
    context: {
      userId: identity.userId,
      auth: toAuthPayload(identity),
      roleAssignments: rolesResult.data,
    },
  };
}

export async function verifyMentorFromAuthHeader(authHeader: string | null): Promise<MentorAuthResult> {
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

  return verifyMentorIdentity(identity);
}

export async function requireMentor(request: NextRequest): Promise<MentorAuthContext | NextResponse> {
  const authResult = await verifyMentorIdentity(await resolveAuthIdentityFromRequest(request));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as MentorAuthContext;
}
