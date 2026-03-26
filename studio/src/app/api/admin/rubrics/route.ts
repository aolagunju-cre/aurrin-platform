import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/admin';
import { auditLog } from '../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../lib/db/client';
import type { RubricDefinition, RubricSummary } from '../../../../lib/rubrics/types';
import { questionCount, validateRubricDefinition } from '../../../../lib/rubrics/validation';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const client = getSupabaseClient();
  const templatesResult = await client.db.listRubricTemplates();
  if (templatesResult.error) {
    return NextResponse.json({ success: false, message: templatesResult.error.message }, { status: 500 });
  }

  const summaries: RubricSummary[] = [];

  for (const template of templatesResult.data) {
    const latestVersionResult = await client.db.getLatestRubricVersionByTemplateId(template.id);
    if (latestVersionResult.error) {
      return NextResponse.json({ success: false, message: latestVersionResult.error.message }, { status: 500 });
    }

    if (!latestVersionResult.data) {
      return NextResponse.json({ success: false, message: `Missing latest rubric version for template ${template.id}.` }, { status: 500 });
    }

    summaries.push({
      id: template.id,
      name: template.name,
      description: template.description,
      version: latestVersionResult.data.version,
      question_count: questionCount(latestVersionResult.data.definition),
      last_updated: latestVersionResult.data.created_at,
    });
  }

  return NextResponse.json({ success: true, data: summaries }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await request.json() as {
    name?: string;
    description?: string;
    definition?: RubricDefinition;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ success: false, message: 'Rubric name is required.' }, { status: 400 });
  }

  if (!body.definition) {
    return NextResponse.json({ success: false, message: 'Rubric definition is required.' }, { status: 400 });
  }

  const definitionValidation = validateRubricDefinition(body.definition);
  if (!definitionValidation.valid) {
    return NextResponse.json({ success: false, message: definitionValidation.message }, { status: 400 });
  }

  const client = getSupabaseClient();

  const templateResult = await client.db.insertRubricTemplate({
    name: body.name.trim(),
    description: body.description?.trim() || null,
  });

  if (templateResult.error || !templateResult.data) {
    return NextResponse.json({ success: false, message: templateResult.error?.message || 'Failed to create rubric template.' }, { status: 500 });
  }

  const versionResult = await client.db.insertRubricVersion({
    rubric_template_id: templateResult.data.id,
    version: 1,
    definition: body.definition,
  });

  if (versionResult.error || !versionResult.data) {
    return NextResponse.json({ success: false, message: versionResult.error?.message || 'Failed to create rubric version.' }, { status: 500 });
  }

  await auditLog(
    'rubric_created',
    authResult.userId,
    {
      resource_type: 'rubric_template',
      resource_id: templateResult.data.id,
      changes: {
        before: null,
        after: {
          template: templateResult.data,
          version: versionResult.data.version,
        },
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        template: templateResult.data,
        version: versionResult.data,
      },
    },
    { status: 201 }
  );
}
