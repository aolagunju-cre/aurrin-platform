import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoFounderProfile } from '@/src/lib/demo/data';
import { canAccessFounderEvent, requireFounderOrAdmin } from '../../../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface FounderPitchRow {
  id: string;
  founder_id: string;
  score_aggregate: number | null;
  score_breakdown: Record<string, unknown> | null;
}

interface JudgeScoreRow {
  judge_id: string;
  total_score: number | null;
  category_scores: Record<string, unknown> | null;
  comments: string | null;
  state: 'draft' | 'submitted' | 'locked';
  submitted_at: string | null;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string;
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

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (DEMO_MODE) {
    const { eventId } = await params;
    const pitch = demoFounderProfile.pitches.find((p) => p.event_id === eventId);
    if (!pitch) {
      return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
    }
    return NextResponse.json(
      {
        success: true,
        data: {
          founder_id: demoFounderProfile.id,
          event_id: eventId,
          publishing_start: null,
          published: pitch.status === 'published',
          aggregate: { total_score: pitch.score, category_breakdown: null },
          per_judge: [],
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
      `event_id=eq.${encodeURIComponent(eventId)}&founder_id=eq.${encodeURIComponent(authResult.founder.id)}&select=id,founder_id,score_aggregate,score_breakdown&limit=1`
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
      `event_id=eq.${encodeURIComponent(eventId)}&founder_id=eq.${encodeURIComponent(founderId)}&select=id,founder_id,score_aggregate,score_breakdown&limit=1`
    );
  } else {
    return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
  }

  if (pitchResult.error) {
    return NextResponse.json({ success: false, message: pitchResult.error.message }, { status: 500 });
  }

  const pitch = pitchResult.data[0] ?? null;
  if (!pitch) {
    return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
  }

  const publishingStart = parseDate(eventResult.data.publishing_start);
  const published = publishingStart ? new Date() >= publishingStart : false;
  if (!published && !authResult.isAdmin) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const judgeScoresResult = await client.db.queryTable<JudgeScoreRow>(
    'judge_scores',
    `founder_pitch_id=eq.${encodeURIComponent(pitch.id)}&state=in.(${encodeURIComponent('submitted,locked')})&select=judge_id,total_score,category_scores,comments,state,submitted_at&limit=2000`
  );
  if (judgeScoresResult.error) {
    return NextResponse.json({ success: false, message: judgeScoresResult.error.message }, { status: 500 });
  }

  const judgeIds = Array.from(new Set(judgeScoresResult.data.map((score) => score.judge_id)));
  let usersById = new Map<string, UserRow>();
  if (judgeIds.length > 0) {
    const encodedJudgeIds = judgeIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
    const usersResult = await client.db.queryTable<UserRow>(
      'users',
      `id=in.(${encodeURIComponent(encodedJudgeIds)})&select=id,name,email&limit=2000`
    );
    if (usersResult.error) {
      return NextResponse.json({ success: false, message: usersResult.error.message }, { status: 500 });
    }

    usersById = new Map(usersResult.data.map((user) => [user.id, user]));
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        founder_id: pitch.founder_id,
        event_id: eventId,
        publishing_start: eventResult.data.publishing_start,
        published,
        aggregate: {
          total_score: pitch.score_aggregate,
          category_breakdown: pitch.score_breakdown,
        },
        per_judge: judgeScoresResult.data.map((score) => {
          const judge = usersById.get(score.judge_id) ?? null;
          return {
            judge_id: score.judge_id,
            judge_name: judge?.name ?? null,
            judge_email: judge?.email ?? null,
            total_score: score.total_score,
            category_scores: score.category_scores,
            comments: score.comments,
            state: score.state,
            submitted_at: score.submitted_at,
          };
        }),
      },
    },
    { status: 200 }
  );
}
