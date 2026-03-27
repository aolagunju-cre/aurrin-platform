import { NextRequest, NextResponse } from 'next/server';
import { canAccessEvent, requireJudge } from '../../../../../../lib/auth/judge';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireJudge(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;
  if (!canAccessEvent(authResult.roleAssignments, eventId)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const pitchesResult = await client.db.listFounderPitchesByEventId(eventId);
  if (pitchesResult.error) {
    return NextResponse.json({ success: false, message: pitchesResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: pitchesResult.data.map((pitch) => ({
        id: pitch.id,
        event_id: pitch.event_id,
        founder_id: pitch.founder_id,
        pitch_order: pitch.pitch_order,
        company_name: pitch.founder?.company_name ?? null,
        founder_name: pitch.founder?.user?.name ?? null,
        founder_email: pitch.founder?.user?.email ?? null,
        created_at: pitch.created_at,
        updated_at: pitch.updated_at,
      })),
    },
    { status: 200 }
  );
}
