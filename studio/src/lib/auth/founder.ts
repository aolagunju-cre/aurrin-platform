import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, type FounderRecord, type RoleAssignmentRecord } from '../db/client';
import { extractTokenFromHeader, type JWTPayload, verifyJWT } from './jwt';

export interface FounderOrAdminContext {
  userId: string;
  auth: JWTPayload;
  founder: FounderRecord | null;
  roleAssignments: RoleAssignmentRecord[];
  isAdmin: boolean;
  isFounder: boolean;
}

interface FounderAuthResult {
  ok: boolean;
  status?: 401 | 403 | 500;
  message?: string;
  context?: FounderOrAdminContext;
}

export function hasFounderRole(roleAssignments: RoleAssignmentRecord[]): boolean {
  return roleAssignments.some(
    (assignment) => assignment.role === 'founder' && (assignment.scope === 'global' || assignment.scope === 'event')
  );
}

export function hasAdminRole(roleAssignments: RoleAssignmentRecord[]): boolean {
  return roleAssignments.some((assignment) => assignment.role === 'admin' && assignment.scope === 'global');
}

export function canAccessFounderEvent(roleAssignments: RoleAssignmentRecord[], eventId: string): boolean {
  return roleAssignments.some(
    (assignment) =>
      assignment.role === 'founder' &&
      (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
  );
}

export async function verifyFounderOrAdminFromAuthHeader(authHeader: string | null): Promise<FounderAuthResult> {
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
    return { ok: false, status: 500, message: 'Could not verify founder authorization' };
  }

  const roleAssignments = rolesResult.data;
  const isAdmin = hasAdminRole(roleAssignments);
  const isFounder = hasFounderRole(roleAssignments);

  if (!isAdmin && !isFounder) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  const founderResult = await client.db.getFounderByUserId(auth.sub);
  if (founderResult.error) {
    return { ok: false, status: 500, message: founderResult.error.message };
  }

  return {
    ok: true,
    context: {
      userId: auth.sub,
      auth,
      founder: founderResult.data,
      roleAssignments,
      isAdmin,
      isFounder,
    },
  };
}

export async function requireFounderOrAdmin(request: NextRequest): Promise<FounderOrAdminContext | NextResponse> {
  const authResult = await verifyFounderOrAdminFromAuthHeader(request.headers.get('authorization'));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as FounderOrAdminContext;
}
