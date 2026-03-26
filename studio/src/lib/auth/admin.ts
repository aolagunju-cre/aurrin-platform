import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../db/client';
import { extractTokenFromHeader, JWTPayload, verifyJWT } from './jwt';

export interface AdminContext {
  userId: string;
  auth: JWTPayload;
}

interface AdminAuthResult {
  ok: boolean;
  status?: 401 | 403 | 500;
  message?: string;
  context?: AdminContext;
}

export async function verifyAdminFromAuthHeader(authHeader: string | null): Promise<AdminAuthResult> {
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
    return { ok: false, status: 500, message: 'Could not verify admin authorization' };
  }

  const hasAdminRole = rolesResult.data.some((assignment) => assignment.role === 'admin' && assignment.scope === 'global');
  if (!hasAdminRole) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }

  return {
    ok: true,
    context: {
      userId: auth.sub,
      auth,
    },
  };
}

export async function requireAdmin(request: NextRequest): Promise<AdminContext | NextResponse> {
  const authResult = await verifyAdminFromAuthHeader(request.headers.get('authorization'));
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
  }

  return authResult.context as AdminContext;
}
