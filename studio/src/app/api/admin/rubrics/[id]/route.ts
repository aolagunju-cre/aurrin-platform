import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { auditLog } from '../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../lib/db/client';
import type { RubricDefinition } from '../../../../../lib/rubrics/types';
import { validateRubricDefinition } from '../../../../../lib/rubrics/validation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;
  const client = getSupabaseClient();

  const templateResult = await client.db.getRubricTemplateById(id);
  if (templateResult.error) {
    return NextResponse.json({ success: false, message: templateResult.error.message }, { status: 500 });
  }

  if (!templateResult.data) {
    return NextResponse.json({ success: false, message: 'Rubric not found.' }, { status: 404 });
  }

  const versionsResult = await client.db.listRubricVersionsByTemplateId(id);
  if (versionsResult.error) {
    return NextResponse.json({ success: false, message: versionsResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        template: templateResult.data,
        versions: versionsResult.data,
        latest: versionsResult.data[0] ?? null,
      },
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;

  const body = await request.json() as {
    name?: string;
    description?: string;
    definition?: RubricDefinition;
  };

  if (!body.definition) {
    return NextResponse.json({ success: false, message: 'Rubric definition is required.' }, { status: 400 });
  }

  const definitionValidation = validateRubricDefinition(body.definition);
  if (!definitionValidation.valid) {
    return NextResponse.json({ success: false, message: definitionValidation.message }, { status: 400 });
  }

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

  if (body.name?.trim() || typeof body.description === 'string') {
    const updateResult = await client.db.updateRubricTemplate(id, {
      name: body.name?.trim() || templateResult.data.name,
      description: typeof body.description === 'string' ? body.description : templateResult.data.description,
    });

    if (updateResult.error) {
      return NextResponse.json({ success: false, message: updateResult.error.message }, { status: 500 });
    }
  }

  const newVersion = latestVersionResult.data.version + 1;
  const insertResult = await client.db.insertRubricVersion({
    rubric_template_id: id,
    version: newVersion,
    definition: body.definition,
  });

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ success: false, message: insertResult.error?.message || 'Failed to create new rubric version.' }, { status: 500 });
  }

  await auditLog(
    'rubric_version_created',
    authResult.userId,
    {
      resource_type: 'rubric_version',
      resource_id: insertResult.data.id,
      changes: {
        before: latestVersionResult.data.definition,
        after: insertResult.data.definition,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        template_id: id,
        previous_version_id: latestVersionResult.data.id,
        version: insertResult.data,
      },
    },
    { status: 200 }
  );
}
