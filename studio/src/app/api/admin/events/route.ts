import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoEvents } from '@/src/lib/demo/data';
import { requireAdmin } from '../../../../lib/auth/admin';
import { auditLog } from '../../../../lib/audit/log';
import { EventStatus, getSupabaseClient } from '../../../../lib/db/client';

interface EventPayload {
  name?: string;
  description?: string | null;
  status?: string;
  start_date?: string;
  end_date?: string;
  max_judges?: number;
  max_founders?: number;
  rubric_id?: string | null;
  config?: Record<string, unknown>;
}

interface FounderAssignmentRow {
  id: string;
  assigned_event_id: string | null;
  status: string;
}

const statusValues: EventStatus[] = ['upcoming', 'live', 'archived'];

function toUiStatus(status: EventStatus): 'Upcoming' | 'Live' | 'Archived' {
  if (status === 'live') return 'Live';
  if (status === 'archived') return 'Archived';
  return 'Upcoming';
}

function sanitizeEventPayload(payload: EventPayload): { valid: boolean; message?: string } {
  if (!payload.name?.trim()) {
    return { valid: false, message: 'Event name is required.' };
  }

  if (!payload.start_date || !payload.end_date) {
    return { valid: false, message: 'start_date and end_date are required.' };
  }

  if (Number.isNaN(Date.parse(payload.start_date)) || Number.isNaN(Date.parse(payload.end_date))) {
    return { valid: false, message: 'start_date and end_date must be valid ISO date strings.' };
  }

  if (new Date(payload.end_date) < new Date(payload.start_date)) {
    return { valid: false, message: 'end_date must be on or after start_date.' };
  }

  if (payload.status && !statusValues.includes(payload.status as EventStatus)) {
    return { valid: false, message: 'status must be one of: upcoming, live, archived.' };
  }

  if (payload.max_judges !== undefined && (!Number.isInteger(payload.max_judges) || payload.max_judges < 0)) {
    return { valid: false, message: 'max_judges must be a non-negative integer.' };
  }

  if (payload.max_founders !== undefined && (!Number.isInteger(payload.max_founders) || payload.max_founders < 0)) {
    return { valid: false, message: 'max_founders must be a non-negative integer.' };
  }

  return { valid: true };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: demoEvents }, { status: 200 });
  }

  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const client = getSupabaseClient();
  const eventsResult = await client.db.listEvents();
  if (eventsResult.error) {
    return NextResponse.json({ success: false, message: eventsResult.error.message }, { status: 500 });
  }

  const roleAssignmentsResult = await client.db.listRoleAssignments();
  if (roleAssignmentsResult.error) {
    return NextResponse.json({ success: false, message: roleAssignmentsResult.error.message }, { status: 500 });
  }

  const founderAssignmentsResult = await client.db.queryTable<FounderAssignmentRow>(
    'founder_applications',
    'select=id,assigned_event_id,status&status=eq.assigned&limit=5000'
  );
  if (founderAssignmentsResult.error) {
    return NextResponse.json({ success: false, message: founderAssignmentsResult.error.message }, { status: 500 });
  }

  const judgeCounts = new Map<string, number>();
  for (const assignment of roleAssignmentsResult.data) {
    if (assignment.role === 'judge' && assignment.scope === 'event' && assignment.scoped_id) {
      judgeCounts.set(assignment.scoped_id, (judgeCounts.get(assignment.scoped_id) ?? 0) + 1);
    }
  }

  const founderCounts = new Map<string, number>();
  for (const assignment of founderAssignmentsResult.data) {
    if (assignment.assigned_event_id) {
      founderCounts.set(assignment.assigned_event_id, (founderCounts.get(assignment.assigned_event_id) ?? 0) + 1);
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: eventsResult.data.map((event) => {
        const config = (event.config ?? {}) as Record<string, unknown>;
        return {
          id: event.id,
          name: event.name,
          status: toUiStatus(event.status),
          status_value: event.status,
          start_date: event.starts_at,
          end_date: event.ends_at,
          dates: `${event.starts_at} - ${event.ends_at}`,
          description: event.description,
          max_judges: typeof config.max_judges === 'number' ? config.max_judges : null,
          max_founders: typeof config.max_founders === 'number' ? config.max_founders : null,
          rubric_id: typeof config.rubric_id === 'string' ? config.rubric_id : null,
          config,
          judge_count: judgeCounts.get(event.id) ?? 0,
          founder_count: founderCounts.get(event.id) ?? 0,
          created_at: event.created_at,
          updated_at: event.updated_at,
        };
      }),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: { id: 'demo-evt-new' } }, { status: 201 });
  }

  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: EventPayload;
  try {
    body = await request.json() as EventPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = sanitizeEventPayload(body);
  if (!validation.valid) {
    return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
  }

  const config = {
    ...(body.config ?? {}),
    max_judges: body.max_judges ?? null,
    max_founders: body.max_founders ?? null,
    rubric_id: body.rubric_id ?? null,
  };

  const client = getSupabaseClient();
  const insertResult = await client.db.insertEvent({
    name: body.name!.trim(),
    description: body.description ?? null,
    status: (body.status as EventStatus | undefined) ?? 'upcoming',
    starts_at: new Date(body.start_date!).toISOString(),
    ends_at: new Date(body.end_date!).toISOString(),
    config,
  });

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { success: false, message: insertResult.error?.message || 'Failed to create event.' },
      { status: 500 }
    );
  }

  await auditLog(
    'event_created',
    authResult.userId,
    {
      resource_type: 'event',
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
