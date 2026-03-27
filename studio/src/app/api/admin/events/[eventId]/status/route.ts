import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import {
  evaluateLifecycleTransition,
  parseLifecycleStatus,
} from '../../../../../../lib/events/lifecycle';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface StatusPayload {
  new_status?: string;
  notes?: string;
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;

  let body: StatusPayload;
  try {
    body = await request.json() as StatusPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const newStatus = parseLifecycleStatus(body.new_status);
  if (!newStatus) {
    return NextResponse.json({ success: false, message: 'new_status must be one of: Live, Archived.' }, { status: 400 });
  }

  if (body.notes !== undefined && typeof body.notes !== 'string') {
    return NextResponse.json({ success: false, message: 'notes must be a string when provided.' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const transition = evaluateLifecycleTransition(eventResult.data.status, newStatus);
  if (!transition.ok || !transition.status) {
    return NextResponse.json(
      { success: false, message: transition.message ?? 'Invalid lifecycle transition.' },
      { status: 400 }
    );
  }

  if (transition.idempotent) {
    return NextResponse.json(
      {
        success: true,
        data: eventResult.data,
        idempotent: true,
      },
      { status: 200 }
    );
  }

  const updateResult = await client.db.updateEvent(eventId, {
    status: transition.status,
    archived_at: transition.status === 'archived'
      ? (eventResult.data.archived_at ?? new Date().toISOString())
      : eventResult.data.archived_at,
  });
  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { success: false, message: updateResult.error?.message ?? 'Failed to update event status.' },
      { status: 500 }
    );
  }

  await auditLog(
    'event_status_changed',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: eventId,
      reason: body.notes?.trim() || null,
      changes: {
        before: { status: eventResult.data.status, archived_at: eventResult.data.archived_at },
        after: { status: updateResult.data.status, archived_at: updateResult.data.archived_at },
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: updateResult.data }, { status: 200 });
}
