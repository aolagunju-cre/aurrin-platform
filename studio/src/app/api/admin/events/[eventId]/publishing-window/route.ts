import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { validateWindowRange } from '../../../../../../lib/events/lifecycle';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface PublishingWindowPayload {
  publishing_start?: string;
  publishing_end?: string;
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;

  let body: PublishingWindowPayload;
  try {
    body = await request.json() as PublishingWindowPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const range = validateWindowRange(body.publishing_start, body.publishing_end, 'publishing_start', 'publishing_end');
  if (!range.ok) {
    return NextResponse.json({ success: false, message: range.message }, { status: 400 });
  }

  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const updateResult = await client.db.updateEvent(eventId, {
    publishing_start: range.start,
    publishing_end: range.end,
  });
  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { success: false, message: updateResult.error?.message ?? 'Failed to update publishing window.' },
      { status: 500 }
    );
  }

  await auditLog(
    'publishing_window_updated',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: eventId,
      changes: {
        before: {
          publishing_start: eventResult.data.publishing_start,
          publishing_end: eventResult.data.publishing_end,
        },
        after: {
          publishing_start: updateResult.data.publishing_start,
          publishing_end: updateResult.data.publishing_end,
        },
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: updateResult.data }, { status: 200 });
}
