import { NextRequest, NextResponse } from 'next/server';
import { canAccessEvent, requireJudge } from '../../../../../lib/auth/judge';
import { getSupabaseClient } from '../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ pitchId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireJudge(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { pitchId } = await params;
  const client = getSupabaseClient();

  const pitchResult = await client.db.getFounderPitchById(pitchId);
  if (pitchResult.error) {
    return NextResponse.json({ success: false, message: pitchResult.error.message }, { status: 500 });
  }
  if (!pitchResult.data) {
    return NextResponse.json({ success: false, message: 'Pitch not found.' }, { status: 404 });
  }

  if (!canAccessEvent(authResult.roleAssignments, pitchResult.data.event_id)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const rubricResult = await client.db.getLatestRubricVersionByEventId(pitchResult.data.event_id);
  if (rubricResult.error) {
    return NextResponse.json({ success: false, message: rubricResult.error.message }, { status: 500 });
  }
  if (!rubricResult.data) {
    return NextResponse.json({ success: false, message: 'Rubric not configured for this event.' }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        pitch: pitchResult.data,
        rubric: rubricResult.data,
      },
    },
    { status: 200 }
  );
}
