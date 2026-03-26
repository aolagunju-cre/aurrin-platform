import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { name?: string };

  const client = getSupabaseClient();

  const templateResult = await client.db.getRubricTemplateById(id);
  if (templateResult.error) {
    return NextResponse.json({ success: false, message: templateResult.error.message }, { status: 500 });
  }

  if (!templateResult.data) {
    return NextResponse.json({ success: false, message: 'Rubric not found.' }, { status: 404 });
  }

  const latestVersionResult = await client.db.getLatestRubricVersionByTemplateId(id);
  if (latestVersionResult.error || !latestVersionResult.data) {
    return NextResponse.json({ success: false, message: latestVersionResult.error?.message || 'Rubric has no existing version.' }, { status: 500 });
  }

  const cloneName = body.name?.trim() || `${templateResult.data.name} (Clone)`;
  const cloneTemplateResult = await client.db.insertRubricTemplate({
    name: cloneName,
    description: templateResult.data.description,
  });

  if (cloneTemplateResult.error || !cloneTemplateResult.data) {
    return NextResponse.json({ success: false, message: cloneTemplateResult.error?.message || 'Failed to clone rubric template.' }, { status: 500 });
  }

  const cloneVersionResult = await client.db.insertRubricVersion({
    rubric_template_id: cloneTemplateResult.data.id,
    version: 1,
    definition: latestVersionResult.data.definition,
  });

  if (cloneVersionResult.error || !cloneVersionResult.data) {
    return NextResponse.json({ success: false, message: cloneVersionResult.error?.message || 'Failed to clone rubric version.' }, { status: 500 });
  }

  await auditLog(
    'rubric_cloned',
    authResult.userId,
    {
      resource_type: 'rubric_template',
      resource_id: cloneTemplateResult.data.id,
      changes: {
        before: { source_template_id: id },
        after: {
          template_id: cloneTemplateResult.data.id,
          version_id: cloneVersionResult.data.id,
        },
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        template: cloneTemplateResult.data,
        version: cloneVersionResult.data,
      },
    },
    { status: 201 }
  );
}
