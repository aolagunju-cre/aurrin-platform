import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string; matchId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId, matchId } = await params;
  const client = getSupabaseClient();

  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ message: 'Event not found.' }, { status: 404 });
  }

  const existingResult = await client.db.getMentorMatchById(matchId);
  if (existingResult.error) {
    return NextResponse.json({ message: existingResult.error.message }, { status: 500 });
  }
  if (!existingResult.data || existingResult.data.event_id !== eventId) {
    return NextResponse.json({ message: 'Match not found for this event.' }, { status: 404 });
  }

  const deleteResult = await client.db.deleteMentorMatchById(matchId);
  if (deleteResult.error) {
    return NextResponse.json({ message: deleteResult.error.message }, { status: 500 });
  }

  await auditLog(
    'mentor_match_deleted_manual',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: eventId,
      changes: {
        match_id: matchId,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: { id: matchId, deleted: true } }, { status: 200 });
}
