import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, type FounderRecord, type RoleAssignmentRecord } from '../db/client';
import { type JWTPayload } from './jwt';
import {
  createDemoRoleAssignments,
  resolveAuthIdentityFromRequest,
  resolveAuthIdentityFromStores,
  toAuthPayload,
} from './request-auth';
import { demoFounderProfile } from '../demo/data';

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
    (assignment) => assignment.role.toLowerCase() === 'founder' && (assignment.scope === 'global' || assignment.scope === 'event')
  );
}

export function hasAdminRole(roleAssignments: RoleAssignmentRecord[]): boolean {
  return roleAssignments.some((assignment) => assignment.role.toLowerCase() === 'admin' && assignment.scope === 'global');
}

export function canAccessFounderEvent(roleAssignments: RoleAssignmentRecord[], eventId: string): boolean {
  return roleAssignments.some(
    (assignment) =>
      assignment.role.toLowerCase() === 'founder' &&
      (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
  );
}

function getDemoFounderRecord(userId: string): FounderRecord {
  return {
    id: demoFounderProfile.id,
    user_id: userId,
    company_name: demoFounderProfile.company,
    tagline: demoFounderProfile.industry,
    bio: demoFounderProfile.bio,
    website: demoFounderProfile.website,
    pitch_deck_url: null,
    social_proof: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

async function verifyFounderOrAdminIdentity(
  identity: Awaited<ReturnType<typeof resolveAuthIdentityFromRequest>>
): Promise<FounderAuthResult> {
  if (!identity) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const client = getSupabaseClient();
  const rolesResult = identity.demoSession
    ? { data: createDemoRoleAssignments(identity), error: null }
    : await client.db.getRoleAssignmentsByUserId(identity.userId);

  if (rolesResult.error) {
    return { ok: false, status: 500, message: 'Could not verify founder authorization' };
  }

  const roleAssignments = rolesResult.data;
  const isAdmin = hasAdminRole(roleAssignments);
  const isFounder = hasFounderRole(roleAssignments);

  if (!isAdmin && !isFounder) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  if (identity.demoSession?.persona === 'founder') {
    return {
      ok: true,
      context: {
        userId: identity.userId,
        auth: toAuthPayload(identity),
        founder: getDemoFounderRecord(identity.userId),
        roleAssignments,
        isAdmin,
        isFounder,
      },
    };
  }

  const founderResult = await client.db.getFounderByUserId(identity.userId);
  if (founderResult.error) {
    return { ok: false, status: 500, message: founderResult.error.message };
  }

  return {
    ok: true,
    context: {
      userId: identity.userId,
      auth: toAuthPayload(identity),
      founder: founderResult.data,
      roleAssignments,
      isAdmin,
      isFounder,
    },
  };
}

export async function verifyFounderOrAdminFromAuthHeader(authHeader: string | null): Promise<FounderAuthResult> {
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

  return verifyFounderOrAdminIdentity(identity);
}

export async function requireFounderOrAdmin(request: NextRequest): Promise<FounderOrAdminContext | NextResponse> {
  const authResult = await verifyFounderOrAdminIdentity(await resolveAuthIdentityFromRequest(request));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as FounderOrAdminContext;
}
