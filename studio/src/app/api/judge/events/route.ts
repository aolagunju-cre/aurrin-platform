import { NextRequest, NextResponse } from 'next/server';
import { requireJudge } from '../../../../lib/auth/judge';
import { getSupabaseClient } from '../../../../lib/db/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireJudge(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const client = getSupabaseClient();
  const hasGlobalJudgeAccess = authResult.roleAssignments.some(
    (assignment) => assignment.role === 'judge' && assignment.scope === 'global'
  );

  if (hasGlobalJudgeAccess) {
    const allEventsResult = await client.db.listEvents();
    if (allEventsResult.error) {
      return NextResponse.json({ success: false, message: allEventsResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: allEventsResult.data }, { status: 200 });
  }

  const assignedEventIds = Array.from(
    new Set(
      authResult.roleAssignments
        .filter((assignment) => assignment.role === 'judge' && assignment.scope === 'event' && assignment.scoped_id)
        .map((assignment) => assignment.scoped_id as string)
    )
  );

  const eventsResult = await client.db.listEventsByIds(assignedEventIds);
  if (eventsResult.error) {
    return NextResponse.json({ success: false, message: eventsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: eventsResult.data }, { status: 200 });
}
