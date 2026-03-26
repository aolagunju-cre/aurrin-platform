import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AssignJudgesPayload {
  judge_user_ids?: string[];
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

  const assignmentsResult = await client.db.listRoleAssignments();
  if (assignmentsResult.error) {
    return NextResponse.json({ success: false, message: assignmentsResult.error.message }, { status: 500 });
  }

  const candidatesMap = new Map<string, { id: string; email: string; name: string | null }>();
  const assignedUserIds: string[] = [];

  for (const assignment of assignmentsResult.data) {
    if (assignment.role !== 'judge') {
      continue;
    }

    if (assignment.user) {
      candidatesMap.set(assignment.user.id, {
        id: assignment.user.id,
        email: assignment.user.email,
        name: assignment.user.name,
      });
    }

    if (assignment.scope === 'event' && assignment.scoped_id === id) {
      assignedUserIds.push(assignment.user_id);
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        assigned_user_ids: Array.from(new Set(assignedUserIds)),
        candidates: Array.from(candidatesMap.values()).sort((a, b) => a.email.localeCompare(b.email)),
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

  let body: AssignJudgesPayload;
  try {
    body = await request.json() as AssignJudgesPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const judgeUserIds = Array.from(new Set(body.judge_user_ids ?? []));
  if (judgeUserIds.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    return NextResponse.json({ success: false, message: 'judge_user_ids must be an array of non-empty user ids.' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const assignmentsResult = await client.db.listRoleAssignments();
  if (assignmentsResult.error) {
    return NextResponse.json({ success: false, message: assignmentsResult.error.message }, { status: 500 });
  }

  const currentEventJudgeAssignments = assignmentsResult.data.filter(
    (assignment) => assignment.role === 'judge' && assignment.scope === 'event' && assignment.scoped_id === id
  );

  const currentUserIds = new Set(currentEventJudgeAssignments.map((assignment) => assignment.user_id));
  const requestedUserIds = new Set(judgeUserIds);

  for (const assignment of currentEventJudgeAssignments) {
    if (!requestedUserIds.has(assignment.user_id)) {
      const deleteResult = await client.db.deleteRoleAssignment(assignment.id);
      if (deleteResult.error) {
        return NextResponse.json({ success: false, message: deleteResult.error.message }, { status: 500 });
      }
    }
  }

  for (const userId of judgeUserIds) {
    if (!currentUserIds.has(userId)) {
      const insertResult = await client.db.insertRoleAssignment({
        user_id: userId,
        role: 'judge',
        scope: 'event',
        scoped_id: id,
        created_by: authResult.userId,
      });

      if (insertResult.error) {
        return NextResponse.json({ success: false, message: insertResult.error.message }, { status: 500 });
      }
    }
  }

  await auditLog(
    'event_judges_assigned',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: id,
      changes: {
        before: Array.from(currentUserIds),
        after: judgeUserIds,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        event_id: id,
        assigned_user_ids: judgeUserIds,
      },
    },
    { status: 200 }
  );
}
