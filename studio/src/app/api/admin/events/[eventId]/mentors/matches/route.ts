import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../../lib/audit/log';
import { MentorMatchStatus, getSupabaseClient } from '../../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface CreateMatchPayload {
  mentor_id?: unknown;
  founder_id?: unknown;
  mentor_status?: unknown;
  founder_status?: unknown;
  notes?: unknown;
  declined_by?: unknown;
}

function isStatus(value: unknown): value is MentorMatchStatus {
  return value === 'pending' || value === 'accepted' || value === 'declined';
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;

  let body: CreateMatchPayload;
  try {
    body = await request.json() as CreateMatchPayload;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.mentor_id !== 'string' || body.mentor_id.trim().length === 0) {
    return NextResponse.json({ message: 'mentor_id must be a non-empty string.' }, { status: 400 });
  }

  if (typeof body.founder_id !== 'string' || body.founder_id.trim().length === 0) {
    return NextResponse.json({ message: 'founder_id must be a non-empty string.' }, { status: 400 });
  }

  if (body.mentor_status !== undefined && !isStatus(body.mentor_status)) {
    return NextResponse.json({ message: 'mentor_status must be one of: pending, accepted, declined.' }, { status: 400 });
  }

  if (body.founder_status !== undefined && !isStatus(body.founder_status)) {
    return NextResponse.json({ message: 'founder_status must be one of: pending, accepted, declined.' }, { status: 400 });
  }

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    return NextResponse.json({ message: 'notes must be a string when provided.' }, { status: 400 });
  }

  if (body.declined_by !== undefined && body.declined_by !== null && typeof body.declined_by !== 'string') {
    return NextResponse.json({ message: 'declined_by must be a string when provided.' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ message: 'Event not found.' }, { status: 404 });
  }

  const mentorsResult = await client.db.listMentorIdsByEventId(eventId);
  if (mentorsResult.error) {
    return NextResponse.json({ message: mentorsResult.error.message }, { status: 500 });
  }
  if (!mentorsResult.data.includes(body.mentor_id)) {
    return NextResponse.json({ message: 'mentor_id is not assigned to this event.' }, { status: 409 });
  }

  const foundersResult = await client.db.listFounderIdsByEventId(eventId);
  if (foundersResult.error) {
    return NextResponse.json({ message: foundersResult.error.message }, { status: 500 });
  }
  if (!foundersResult.data.includes(body.founder_id)) {
    return NextResponse.json({ message: 'founder_id is not assigned to this event.' }, { status: 409 });
  }

  const insertResult = await client.db.insertMentorMatch({
    mentor_id: body.mentor_id,
    founder_id: body.founder_id,
    event_id: eventId,
    mentor_status: body.mentor_status ?? 'pending',
    founder_status: body.founder_status ?? 'pending',
    notes: typeof body.notes === 'string' ? body.notes : null,
    declined_by: typeof body.declined_by === 'string' ? body.declined_by : null,
  });

  if (insertResult.error) {
    return NextResponse.json({ message: insertResult.error.message }, { status: 500 });
  }

  if (!insertResult.data) {
    return NextResponse.json({ message: 'Failed to create mentor match.' }, { status: 500 });
  }

  await auditLog(
    'mentor_match_created_manual',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: eventId,
      changes: {
        match_id: insertResult.data.id,
        mentor_id: insertResult.data.mentor_id,
        founder_id: insertResult.data.founder_id,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: insertResult.data }, { status: 200 });
}
