import { headers } from 'next/headers';
import { JWTPayload, verifyJWT, extractTokenFromHeader } from './jwt';

export interface RoleAssignment {
  user_id: string;
  role: 'Admin' | 'Judge' | 'Founder' | 'Mentor' | 'Subscriber' | 'Audience';
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

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return null;
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return null;
    }

    // Fetch role assignments from database
    // This would call the Supabase API or your Next.js API
    const roleAssignments = await fetchUserRoleAssignments(payload.sub);

    const user: SessionUser = {
      id: payload.sub,
      email: payload.email,
      emailConfirmed: !!payload.email_confirmed_at,
      roleAssignments: roleAssignments || [],
    };

    return user;
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

  // Admin has all permissions
  const adminRole = roleAssignments.find((ra) => ra.role === 'Admin' && ra.scope === 'global');
  if (adminRole) {
    return true;
  }

  // Check for specific role
  const roleMatch = roleAssignments.find((ra) => ra.role === role);
  if (!roleMatch) {
    return false;
  }

  // If scope is not specified, any role assignment matches
  if (!scope) {
    return true;
  }

  // Check scope matching
  if (roleMatch.scope === 'global') {
    return true;
  }

  if (roleMatch.scope === scope.type && roleMatch.scoped_id === scope.id) {
    return true;
  }

  return false;
}

export function getEffectiveRoles(
  roleAssignments: RoleAssignment[]
): Array<{ role: string; scope: string; scoped_id: string | null }> {
  return roleAssignments.map((ra) => ({
    role: ra.role,
    scope: ra.scope,
    scoped_id: ra.scoped_id,
  }));
}

export async function getSessionContext(): Promise<SessionContext> {
  if (sessionContext) {
    return sessionContext;
  }

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
    // This would fetch from your Supabase database
    // For now, return empty array
    // Implementation would use createClient from '@supabase/supabase-js'
    // and query the role_assignments table
    return [];
  } catch (error) {
    console.error('Error fetching role assignments:', error);
    return null;
  }
}

// Reset session context (useful for testing)
export function resetSessionContext(): void {
  sessionContext = null;
}
