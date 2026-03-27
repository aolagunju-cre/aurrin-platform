import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoFounderProfile, demoEvents } from '@/src/lib/demo/data';
import { canAccessFounderEvent, requireFounderOrAdmin } from '../../../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface FounderPitchRow {
  id: string;
  founder_id: string;
  event_id: string;
  pitch_order: number | null;
  pitch_deck_url: string | null;
  score_aggregate: number | null;
  score_breakdown: Record<string, unknown> | null;
  validation_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface JudgeAssignmentRow {
  user_id: string;
}

interface JudgeScoreProgressRow {
  state: 'draft' | 'submitted' | 'locked';
}

interface QueryResult<T> {
  data: T[];
  error: Error | null;
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function buildPitchNotFound(): NextResponse {
  return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (DEMO_MODE) {
    const { eventId } = await params;
    const event = demoEvents.find((e) => e.id === eventId);
    const pitch = demoFounderProfile.pitches.find((p) => p.event_id === eventId);
    if (!event || !pitch) {
      return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
    }
    return NextResponse.json(
      {
        success: true,
        data: {
          event: { id: event.id, name: event.name, status: event.status, scoring_start: event.scoring_start, scoring_end: event.scoring_end, publishing_start: event.publishing_start, publishing_end: event.publishing_end },
          pitch: { id: pitch.id, founder_id: demoFounderProfile.id, event_id: eventId, pitch_order: null, pitch_deck_url: null, score_aggregate: pitch.score, score_breakdown: null, validation_summary: null, scoring_status: pitch.status === 'published' ? 'scores_published' : 'judges_scoring', scores_published: pitch.status === 'published', validation_available: pitch.status === 'published', score_progress: { submitted: 0, total: 0 } },
        },
      },
      { status: 200 }
    );
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { eventId } = await params;
  const client = getSupabaseClient();

  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  if (!authResult.isAdmin && !canAccessFounderEvent(authResult.roleAssignments, eventId)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let pitchResult: QueryResult<FounderPitchRow>;
  if (authResult.founder) {
    pitchResult = await client.db.queryTable<FounderPitchRow>(
      'founder_pitches',
      `event_id=eq.${encodeURIComponent(eventId)}&founder_id=eq.${encodeURIComponent(authResult.founder.id)}&select=id,founder_id,event_id,pitch_order,pitch_deck_url,score_aggregate,score_breakdown,validation_summary,created_at,updated_at&limit=1`
    );
  } else if (authResult.isAdmin) {
    const founderId = request.nextUrl.searchParams.get('founder_id');
    if (!founderId) {
      return NextResponse.json(
        { success: false, message: 'Admin requests must include founder_id query parameter.' },
        { status: 400 }
      );
    }

    pitchResult = await client.db.queryTable<FounderPitchRow>(
      'founder_pitches',
      `event_id=eq.${encodeURIComponent(eventId)}&founder_id=eq.${encodeURIComponent(founderId)}&select=id,founder_id,event_id,pitch_order,pitch_deck_url,score_aggregate,score_breakdown,validation_summary,created_at,updated_at&limit=1`
    );
  } else {
    return buildPitchNotFound();
  }

  if (pitchResult.error) {
    return NextResponse.json({ success: false, message: pitchResult.error.message }, { status: 500 });
  }

  const pitch = pitchResult.data[0] ?? null;
  if (!pitch) {
    return buildPitchNotFound();
  }

  const judgeAssignmentsResult = await client.db.queryTable<JudgeAssignmentRow>(
    'role_assignments',
    `role=eq.judge&scope=eq.event&scoped_id=eq.${encodeURIComponent(eventId)}&select=user_id&limit=2000`
  );
  if (judgeAssignmentsResult.error) {
    return NextResponse.json({ success: false, message: judgeAssignmentsResult.error.message }, { status: 500 });
  }

  const judgeScoresResult = await client.db.queryTable<JudgeScoreProgressRow>(
    'judge_scores',
    `founder_pitch_id=eq.${encodeURIComponent(pitch.id)}&select=state&limit=2000`
  );
  if (judgeScoresResult.error) {
    return NextResponse.json({ success: false, message: judgeScoresResult.error.message }, { status: 500 });
  }

  const submitted = judgeScoresResult.data.filter((score) => score.state === 'submitted' || score.state === 'locked').length;
  const total = judgeAssignmentsResult.data.length;

  const now = new Date();
  const publishingStart = parseDate(eventResult.data.publishing_start);
  const publishingOpen = publishingStart ? now >= publishingStart : false;

  let scoringStatus: 'judges_scoring' | 'scores_publish_pending' | 'scores_published' = 'judges_scoring';
  if (publishingOpen) {
    scoringStatus = 'scores_published';
  } else if (submitted > 0 || total > 0) {
    scoringStatus = 'scores_publish_pending';
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        event: {
          id: eventResult.data.id,
          name: eventResult.data.name,
          status: eventResult.data.status,
          scoring_start: eventResult.data.scoring_start,
          scoring_end: eventResult.data.scoring_end,
          publishing_start: eventResult.data.publishing_start,
          publishing_end: eventResult.data.publishing_end,
        },
        pitch: {
          id: pitch.id,
          founder_id: pitch.founder_id,
          event_id: pitch.event_id,
          pitch_order: pitch.pitch_order,
          pitch_deck_url: pitch.pitch_deck_url,
          score_aggregate: publishingOpen || authResult.isAdmin ? pitch.score_aggregate : null,
          score_breakdown: publishingOpen || authResult.isAdmin ? pitch.score_breakdown : null,
          validation_summary: publishingOpen || authResult.isAdmin ? pitch.validation_summary : null,
          scoring_status: scoringStatus,
          scores_published: publishingOpen,
          validation_available: publishingOpen,
          score_progress: {
            submitted,
            total,
          },
        },
      },
    },
    { status: 200 }
  );
}
