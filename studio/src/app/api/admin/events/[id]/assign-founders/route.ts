import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { FounderApplicationRecord, getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AssignFoundersPayload {
  founder_application_ids?: string[];
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;
  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(id);

  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }

  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const foundersResult = await client.db.queryTable<FounderApplicationRecord>(
    'founder_applications',
    'select=id,email,name,full_name,company_name,status,assigned_event_id&status=in.(accepted,assigned)&order=created_at.desc&limit=500'
  );

  if (foundersResult.error) {
    return NextResponse.json({ success: false, message: foundersResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        assigned_founder_application_ids: foundersResult.data
          .filter((founder) => founder.assigned_event_id === id)
          .map((founder) => founder.id),
        candidates: foundersResult.data.map((founder) => ({
          id: founder.id,
          email: founder.email,
          name: founder.full_name || founder.name,
          company_name: founder.company_name,
          status: founder.status,
          assigned_event_id: founder.assigned_event_id,
        })),
      },
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;

  let body: AssignFoundersPayload;
  try {
    body = await request.json() as AssignFoundersPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const founderApplicationIds = Array.from(new Set(body.founder_application_ids ?? []));
  if (founderApplicationIds.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    return NextResponse.json(
      { success: false, message: 'founder_application_ids must be an array of non-empty ids.' },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const currentAssignmentsResult = await client.db.queryTable<FounderApplicationRecord>(
    'founder_applications',
    `select=id,status,assigned_event_id&assigned_event_id=eq.${id}&status=in.(accepted,assigned)&limit=1000`
  );

  if (currentAssignmentsResult.error) {
    return NextResponse.json({ success: false, message: currentAssignmentsResult.error.message }, { status: 500 });
  }

  const currentIds = new Set(currentAssignmentsResult.data.map((founder) => founder.id));
  const requestedIds = new Set(founderApplicationIds);

  for (const founder of currentAssignmentsResult.data) {
    if (!requestedIds.has(founder.id)) {
      const unassignResult = await client.db.updateFounderApplication(founder.id, {
        status: 'accepted',
        assigned_event_id: null,
      });
      if (unassignResult.error) {
        return NextResponse.json({ success: false, message: unassignResult.error.message }, { status: 500 });
      }
    }
  }

  for (const founderId of founderApplicationIds) {
    const founderResult = await client.db.getFounderApplicationById(founderId);
    if (founderResult.error) {
      return NextResponse.json({ success: false, message: founderResult.error.message }, { status: 500 });
    }
    if (!founderResult.data) {
      return NextResponse.json({ success: false, message: `Founder application ${founderId} not found.` }, { status: 404 });
    }
    if (!['accepted', 'assigned'].includes(founderResult.data.status)) {
      return NextResponse.json(
        { success: false, message: `Founder application ${founderId} must be accepted before assignment.` },
        { status: 409 }
      );
    }

    const assignResult = await client.db.updateFounderApplication(founderId, {
      status: 'assigned',
      assigned_event_id: id,
    });
    if (assignResult.error) {
      return NextResponse.json({ success: false, message: assignResult.error.message }, { status: 500 });
    }
  }

  await auditLog(
    'event_founders_assigned',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: id,
      changes: {
        before: Array.from(currentIds),
        after: founderApplicationIds,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        event_id: id,
        assigned_founder_application_ids: founderApplicationIds,
      },
    },
    { status: 200 }
  );
}
