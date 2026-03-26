import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/admin';
import { auditLog } from '../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../lib/db/client';
import { isValidRoleScope, isValidUserRole, validateScopedId } from '../../../../lib/admin/roles';

interface AssignRolePayload {
  user_id?: string;
  role?: string;
  scope?: string;
  scoped_id?: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const client = getSupabaseClient();
  const result = await client.db.listRoleAssignments();
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: result.data.map((assignment) => ({
        id: assignment.id,
        role: assignment.role,
        scope: assignment.scope,
        scoped_id: assignment.scoped_id,
        assigned_at: assignment.created_at,
        user: assignment.user
          ? {
              id: assignment.user.id,
              name: assignment.user.name,
              email: assignment.user.email,
            }
          : null,
        assigned_by: assignment.assigned_by_user
          ? {
              id: assignment.assigned_by_user.id,
              name: assignment.assigned_by_user.name,
              email: assignment.assigned_by_user.email,
            }
          : null,
      })),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: AssignRolePayload;
  try {
    body = await request.json() as AssignRolePayload;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body.' } },
      { status: 400 }
    );
  }

  if (!body.user_id || !body.role || !body.scope) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'user_id, role, and scope are required.' } },
      { status: 400 }
    );
  }

  if (!isValidUserRole(body.role)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ROLE', message: 'Role must be one of: admin, judge, founder, mentor, subscriber.' } },
      { status: 400 }
    );
  }

  if (!isValidRoleScope(body.scope)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_SCOPE', message: 'Scope must be one of: global, event, founder, subscriber.' } },
      { status: 400 }
    );
  }

  const scopedId = body.scoped_id ?? null;
  const scopedValidation = validateScopedId(body.scope, scopedId);
  if (!scopedValidation.valid) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_SCOPE', message: scopedValidation.message ?? 'Invalid scope and scoped_id combination.' } },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();
  const existingResult = await client.db.getRoleAssignmentsByUserId(body.user_id);
  if (existingResult.error) {
    return NextResponse.json({ success: false, message: existingResult.error.message }, { status: 500 });
  }

  const isDuplicate = existingResult.data.some((assignment) =>
    assignment.role === body.role
    && assignment.scope === body.scope
    && (assignment.scoped_id ?? null) === scopedId
  );

  if (isDuplicate) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_ASSIGNMENT',
          message: 'Role assignment already exists for user, role, and scope.',
        },
      },
      { status: 409 }
    );
  }

  const insertResult = await client.db.insertRoleAssignment({
    user_id: body.user_id,
    role: body.role,
    scope: body.scope,
    scoped_id: scopedId,
    created_by: authResult.userId,
  });

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { success: false, message: insertResult.error?.message || 'Failed to assign role.' },
      { status: 500 }
    );
  }

  await auditLog(
    'role_assigned',
    authResult.userId,
    {
      resource_type: 'role_assignment',
      resource_id: insertResult.data.id,
      changes: {
        before: null,
        after: insertResult.data,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: insertResult.data }, { status: 201 });
}
