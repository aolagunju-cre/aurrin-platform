import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoDirectoryProfiles, demoEvents } from '@/src/lib/demo/data';
import { canAccessEvent, requireJudge } from '../../../../../../lib/auth/judge';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

function isScoringWindowOpen(scoringStart: string | null, scoringEnd: string | null): boolean {
  if (!scoringStart || !scoringEnd) {
    return false;
  }

  const now = Date.now();
  const start = Date.parse(scoringStart);
  const end = Date.parse(scoringEnd);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }

  return now >= start && now <= end;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (DEMO_MODE) {
    const { eventId } = await params;
    const event = demoEvents.find((e) => e.id === eventId);
    if (!event) {
      return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
    }
    const pitches = demoDirectoryProfiles
      .filter((p) => p.event.id === eventId)
      .map((p, idx) => ({
        id: `pitch-${eventId}-${idx}`,
        event_id: eventId,
        founder_id: p.founder_slug,
        pitch_order: idx + 1,
        company_name: p.company,
        founder_name: p.founder_name,
        founder_email: null,
        created_at: event.created_at,
        updated_at: event.updated_at,
      }));
    return NextResponse.json(
      {
        success: true,
        meta: { scoring_window_open: event.status === 'live', scoring_end: event.scoring_end },
        data: pitches,
      },
      { status: 200 }
    );
  }

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
      meta: {
        scoring_window_open: isScoringWindowOpen(eventResult.data.scoring_start, eventResult.data.scoring_end),
        scoring_end: eventResult.data.scoring_end,
      },
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
