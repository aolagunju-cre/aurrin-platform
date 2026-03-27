import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import {
  validateScoringWindowAgainstEventBounds,
  validateWindowRange,
} from '../../../../../../lib/events/lifecycle';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface ScoringWindowPayload {
  scoring_start?: string;
  scoring_end?: string;
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;

  let body: ScoringWindowPayload;
  try {
    body = await request.json() as ScoringWindowPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const range = validateWindowRange(body.scoring_start, body.scoring_end, 'scoring_start', 'scoring_end');
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

  const boundaries = validateScoringWindowAgainstEventBounds(eventResult.data, range.start, range.end);
  if (!boundaries.ok) {
    return NextResponse.json({ success: false, message: boundaries.message }, { status: 400 });
  }

  const updateResult = await client.db.updateEvent(eventId, {
    scoring_start: range.start,
    scoring_end: range.end,
  });
  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { success: false, message: updateResult.error?.message ?? 'Failed to update scoring window.' },
      { status: 500 }
    );
  }

  await auditLog(
    'scoring_window_updated',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: eventId,
      changes: {
        before: {
          scoring_start: eventResult.data.scoring_start,
          scoring_end: eventResult.data.scoring_end,
        },
        after: {
          scoring_start: updateResult.data.scoring_start,
          scoring_end: updateResult.data.scoring_end,
        },
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: updateResult.data }, { status: 200 });
}
