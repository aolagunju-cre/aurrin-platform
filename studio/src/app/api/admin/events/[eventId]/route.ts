import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { auditLog } from '../../../../../lib/audit/log';
import { EventStatus, getSupabaseClient } from '../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface EventPatchPayload {
  name?: string;
  description?: string | null;
  status?: string;
  start_date?: string;
  end_date?: string;
  logo_url?: string | null;
  image_url?: string | null;
  max_judges?: number;
  max_founders?: number;
  rubric_id?: string | null;
  config?: Record<string, unknown>;
}

const statusValues: EventStatus[] = ['upcoming', 'live', 'archived'];

function toUiStatus(status: EventStatus): 'Upcoming' | 'Live' | 'Archived' {
  if (status === 'live') return 'Live';
  if (status === 'archived') return 'Archived';
  return 'Upcoming';
}

function parseConfig(source: Record<string, unknown> | null): Record<string, unknown> {
  return source && typeof source === 'object' ? source : {};
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;
  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(eventId);

  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }

  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const config = parseConfig(eventResult.data.config);

  return NextResponse.json(
    {
      success: true,
      data: {
        id: eventResult.data.id,
        name: eventResult.data.name,
        description: eventResult.data.description,
        status: toUiStatus(eventResult.data.status),
        status_value: eventResult.data.status,
        start_date: eventResult.data.start_date,
        end_date: eventResult.data.end_date,
        scoring_start: eventResult.data.scoring_start,
        scoring_end: eventResult.data.scoring_end,
        publishing_start: eventResult.data.publishing_start,
        publishing_end: eventResult.data.publishing_end,
        logo_url: typeof config.logo_url === 'string' ? config.logo_url : null,
        image_url: typeof config.image_url === 'string' ? config.image_url : null,
        max_judges: typeof config.max_judges === 'number' ? config.max_judges : null,
        max_founders: typeof config.max_founders === 'number' ? config.max_founders : null,
        rubric_id: typeof config.rubric_id === 'string' ? config.rubric_id : null,
        config,
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

  const { eventId } = await params;

  let body: EventPatchPayload;
  try {
    body = await request.json() as EventPatchPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const existingResult = await client.db.getEventById(eventId);

  if (existingResult.error) {
    return NextResponse.json({ success: false, message: existingResult.error.message }, { status: 500 });
  }

  if (!existingResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  if (body.status && !statusValues.includes(body.status as EventStatus)) {
    return NextResponse.json({ success: false, message: 'status must be one of: upcoming, live, archived.' }, { status: 400 });
  }

  if (body.start_date && Number.isNaN(Date.parse(body.start_date))) {
    return NextResponse.json({ success: false, message: 'start_date must be a valid ISO date string.' }, { status: 400 });
  }

  if (body.end_date && Number.isNaN(Date.parse(body.end_date))) {
    return NextResponse.json({ success: false, message: 'end_date must be a valid ISO date string.' }, { status: 400 });
  }

  const effectiveStart = body.start_date ? new Date(body.start_date) : new Date(existingResult.data.starts_at);
  const effectiveEnd = body.end_date ? new Date(body.end_date) : new Date(existingResult.data.ends_at);

  if (effectiveEnd < effectiveStart) {
    return NextResponse.json({ success: false, message: 'end_date must be on or after start_date.' }, { status: 400 });
  }

  if (body.max_judges !== undefined && (!Number.isInteger(body.max_judges) || body.max_judges < 0)) {
    return NextResponse.json({ success: false, message: 'max_judges must be a non-negative integer.' }, { status: 400 });
  }

  if (body.max_founders !== undefined && (!Number.isInteger(body.max_founders) || body.max_founders < 0)) {
    return NextResponse.json({ success: false, message: 'max_founders must be a non-negative integer.' }, { status: 400 });
  }

  const baseConfig = parseConfig(existingResult.data.config);
  const nextConfig: Record<string, unknown> = {
    ...baseConfig,
    ...(body.config ?? {}),
  };

  if (body.max_judges !== undefined) {
    nextConfig.max_judges = body.max_judges;
  }
  if (body.max_founders !== undefined) {
    nextConfig.max_founders = body.max_founders;
  }
  if (body.rubric_id !== undefined) {
    nextConfig.rubric_id = body.rubric_id;
  }
  if (body.logo_url !== undefined) {
    nextConfig.logo_url = body.logo_url;
  }
  if (body.image_url !== undefined) {
    nextConfig.image_url = body.image_url;
  }

  const updateResult = await client.db.updateEvent(eventId, {
    name: body.name?.trim() || existingResult.data.name,
    description: body.description !== undefined ? body.description : existingResult.data.description,
    status: (body.status as EventStatus | undefined) ?? existingResult.data.status,
    start_date: body.start_date ? new Date(body.start_date).toISOString() : existingResult.data.start_date,
    end_date: body.end_date ? new Date(body.end_date).toISOString() : existingResult.data.end_date,
    starts_at: body.start_date ? new Date(body.start_date).toISOString() : existingResult.data.starts_at,
    ends_at: body.end_date ? new Date(body.end_date).toISOString() : existingResult.data.ends_at,
    config: nextConfig,
  });

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ success: false, message: updateResult.error?.message || 'Failed to update event.' }, { status: 500 });
  }

  await auditLog(
    'event_updated',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: updateResult.data.id,
      changes: {
        before: existingResult.data,
        after: updateResult.data,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: updateResult.data }, { status: 200 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;
  const client = getSupabaseClient();
  const existingResult = await client.db.getEventById(eventId);

  if (existingResult.error) {
    return NextResponse.json({ success: false, message: existingResult.error.message }, { status: 500 });
  }

  if (!existingResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: false,
      message: 'Event deletion is not supported. Use PATCH /api/admin/events/[eventId]/status to archive events.',
    },
    { status: 405 }
  );
}
