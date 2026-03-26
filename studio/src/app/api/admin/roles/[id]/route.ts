import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { auditLog } from '../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../lib/db/client';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, message: 'Role assignment id is required.' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const deleteResult = await client.db.deleteRoleAssignment(id);
  if (deleteResult.error) {
    return NextResponse.json({ success: false, message: deleteResult.error.message }, { status: 500 });
  }

  if (!deleteResult.data) {
    return NextResponse.json({ success: false, message: 'Role assignment not found.' }, { status: 404 });
  }

  await auditLog(
    'role_revoked',
    authResult.userId,
    {
      resource_type: 'role_assignment',
      resource_id: deleteResult.data.id,
      changes: {
        before: deleteResult.data,
        after: null,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: deleteResult.data }, { status: 200 });
}
