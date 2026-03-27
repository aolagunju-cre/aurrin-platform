import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../../lib/db/client';
import { buildMentorMatches } from '../../../../../../../lib/mentoring/matching';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface MatchRequestPayload {
  num_mentors_per_founder?: unknown;
  exclude_previous_pairs_months?: unknown;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function getWindowStartIso(months: number): string {
  const now = new Date();
  now.setMonth(now.getMonth() - months);
  return now.toISOString();
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;

  let body: MatchRequestPayload;
  try {
    body = await request.json() as MatchRequestPayload;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isPositiveInteger(body.num_mentors_per_founder)) {
    return NextResponse.json({ message: 'num_mentors_per_founder must be a positive integer.' }, { status: 400 });
  }

  if (!isNonNegativeInteger(body.exclude_previous_pairs_months)) {
    return NextResponse.json({ message: 'exclude_previous_pairs_months must be a non-negative integer.' }, { status: 400 });
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

  const foundersResult = await client.db.listFounderIdsByEventId(eventId);
  if (foundersResult.error) {
    return NextResponse.json({ message: foundersResult.error.message }, { status: 500 });
  }

  const windowStartIso = getWindowStartIso(body.exclude_previous_pairs_months);
  const recentPairsResult = await client.db.listRecentMentorPairs(
    mentorsResult.data,
    foundersResult.data,
    windowStartIso
  );
  if (recentPairsResult.error) {
    return NextResponse.json({ message: recentPairsResult.error.message }, { status: 500 });
  }

  const recentPairSet = new Set(recentPairsResult.data.map((pair) => `${pair.mentor_id}:${pair.founder_id}`));

  const matchPlan = buildMentorMatches(
    mentorsResult.data,
    foundersResult.data,
    body.num_mentors_per_founder,
    (mentorId, founderId) => recentPairSet.has(`${mentorId}:${founderId}`)
  );

  let createdCount = 0;
  for (const pair of matchPlan.matches) {
    const insertResult = await client.db.insertMentorMatch({
      mentor_id: pair.mentor_id,
      founder_id: pair.founder_id,
      event_id: eventId,
      mentor_status: 'pending',
      founder_status: 'pending',
    });

    if (insertResult.error) {
      return NextResponse.json({ message: insertResult.error.message }, { status: 500 });
    }

    if (insertResult.data) {
      createdCount += 1;
    }
  }

  await auditLog(
    'mentor_matches_generated',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: eventId,
      changes: {
        event_id: eventId,
        num_mentors_per_founder: body.num_mentors_per_founder,
        exclude_previous_pairs_months: body.exclude_previous_pairs_months,
        matches_created: createdCount,
        conflicts: matchPlan.conflicts,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      matches_created: createdCount,
      conflicts: matchPlan.conflicts,
    },
    { status: 200 }
  );
}
