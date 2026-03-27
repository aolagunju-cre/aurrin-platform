import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';
import { resolveAuthIdentityFromRequest } from '../../../../lib/auth/request-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function hasAdminAccess(assignments: Array<{ role: string; scope: string }>): boolean {
  return assignments.some((assignment) => assignment.role === 'admin' && assignment.scope === 'global');
}

function hasJudgeAccess(assignments: Array<{ role: string; scope: string; scoped_id: string | null }>, eventId: string): boolean {
  return assignments.some(
    (assignment) =>
      assignment.role === 'judge' &&
      (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
  );
}

function hasFounderEventScopedRole(
  assignments: Array<{ role: string; scope: string; scoped_id: string | null }>,
  eventId: string
): boolean {
  return assignments.some(
    (assignment) => assignment.role === 'founder' && assignment.scope === 'event' && assignment.scoped_id === eventId
  );
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const identity = await resolveAuthIdentityFromRequest(request);
  if (!identity) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const client = getSupabaseClient();
  const rolesResult = await client.db.getRoleAssignmentsByUserId(identity.userId);
  if (rolesResult.error) {
    return NextResponse.json({ success: false, message: rolesResult.error.message }, { status: 500 });
  }

  const roleAssignments = rolesResult.data;
  const isAdmin = hasAdminAccess(roleAssignments);
  const isJudgeForEvent = hasJudgeAccess(roleAssignments, id);
  let isFounderForEvent = hasFounderEventScopedRole(roleAssignments, id);

  if (!isFounderForEvent && roleAssignments.some((assignment) => assignment.role === 'founder')) {
    const founderResult = await client.db.getFounderByUserId(identity.userId);
    if (founderResult.error) {
      return NextResponse.json({ success: false, message: founderResult.error.message }, { status: 500 });
    }

    if (founderResult.data) {
      const founderPitchResult = await client.db.queryTable<{ id: string }>(
        'founder_pitches',
        `select=id&founder_id=eq.${founderResult.data.id}&event_id=eq.${id}&limit=1`
      );
      if (founderPitchResult.error) {
        return NextResponse.json({ success: false, message: founderPitchResult.error.message }, { status: 500 });
      }
      isFounderForEvent = founderPitchResult.data.length > 0;
    }
  }

  if (!isAdmin && !isJudgeForEvent && !isFounderForEvent) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const eventResult = await client.db.getEventById(id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: eventResult.data }, { status: 200 });
}
