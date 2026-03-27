import { cookies, headers } from 'next/headers';
import { getSupabaseClient } from '../db/client';
import { createDemoRoleAssignments, normalizeRole, resolveAuthIdentityFromStores } from './request-auth';

export interface RoleAssignment {
  user_id: string;
  role: string;
  scope: 'global' | 'event' | 'founder' | 'subscriber';
  scoped_id: string | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
  roleAssignments: RoleAssignment[];
}

export interface SessionContext {
  user: SessionUser | null;
  isAuthenticated: boolean;
  hasRole: (role: string, scope?: { type: string; id: string }) => boolean;
  getEffectiveRoles: () => Array<{
    role: string;
    scope: string;
    scoped_id: string | null;
  }>;
}

let sessionContext: SessionContext | null = null;

function mapRoleAssignments(
  assignments: Array<{
    user_id: string;
    role: string;
    scope: string;
    scoped_id: string | null;
    created_at: string;
  }>
): RoleAssignment[] {
  return assignments.map((assignment) => ({
    user_id: assignment.user_id,
    role: assignment.role,
    scope: assignment.scope as RoleAssignment['scope'],
    scoped_id: assignment.scoped_id,
    created_at: assignment.created_at,
  }));
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);
    const identity = await resolveAuthIdentityFromStores(headersList, cookieStore);
    if (!identity) {
      return null;
    }

    const roleAssignments = identity.demoSession
      ? mapRoleAssignments(createDemoRoleAssignments(identity))
      : await fetchUserRoleAssignments(identity.userId);

    return {
      id: identity.userId,
      email: identity.email,
      emailConfirmed: Boolean(identity.jwt?.email_confirmed_at) || identity.kind === 'demo-session',
      roleAssignments: roleAssignments ?? [],
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export function hasRole(
  roleAssignments: RoleAssignment[],
  role: string,
  scope?: { type: string; id: string }
): boolean {
  if (!roleAssignments || roleAssignments.length === 0) {
    return false;
  }

  const requestedRole = normalizeRole(role) ?? role.trim().toLowerCase();
  const adminRole = roleAssignments.find((assignment) => normalizeRole(assignment.role) === 'admin' && assignment.scope === 'global');
  if (adminRole) {
    return true;
  }

  const roleMatch = roleAssignments.find((assignment) => normalizeRole(assignment.role) === requestedRole);
  if (!roleMatch) {
    return false;
  }

  if (!scope) {
    return true;
  }

  if (roleMatch.scope === 'global') {
    return true;
  }

  return roleMatch.scope === scope.type && roleMatch.scoped_id === scope.id;
}

export function getEffectiveRoles(
  roleAssignments: RoleAssignment[]
): Array<{ role: string; scope: string; scoped_id: string | null }> {
  return roleAssignments.map((assignment) => ({
    role: assignment.role,
    scope: assignment.scope,
    scoped_id: assignment.scoped_id,
  }));
}

export async function getSessionContext(): Promise<SessionContext> {
  const user = await getCurrentUser();

  sessionContext = {
    user,
    isAuthenticated: !!user,
    hasRole: (role: string, scope?: { type: string; id: string }) =>
      user ? hasRole(user.roleAssignments, role, scope) : false,
    getEffectiveRoles: () => (user ? getEffectiveRoles(user.roleAssignments) : []),
  };

  return sessionContext;
}

async function fetchUserRoleAssignments(userId: string): Promise<RoleAssignment[] | null> {
  try {
    const result = await getSupabaseClient().db.getRoleAssignmentsByUserId(userId);
    if (result.error) {
      return null;
    }

    return mapRoleAssignments(result.data);
  } catch (error) {
    console.error('Error fetching role assignments:', error);
    return null;
  }
}

export function resetSessionContext(): void {
  sessionContext = null;
}
