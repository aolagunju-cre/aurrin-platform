import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyJWT } from '../../../../lib/auth/jwt';
import { getSupabaseClient } from '../../../../lib/db/client';

interface FounderPitchRow {
  id: string;
  event_id: string;
  pitch_deck_url: string | null;
  score_aggregate: number | null;
  score_breakdown: Record<string, unknown> | null;
}

interface JudgeAssignmentRow {
  scoped_id: string;
  user_id: string;
}

interface JudgeScoreRow {
  founder_pitch_id: string;
  state: 'draft' | 'submitted' | 'locked';
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

function isWithinScoringWindow(scoringStart: string | null, scoringEnd: string | null, now: Date): boolean {
  const start = parseDate(scoringStart);
  const end = parseDate(scoringEnd);

  if (!start || !end) {
    return false;
  }

  return now >= start && now <= end;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = extractTokenFromHeader(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const auth = await verifyJWT(token);
  if (!auth?.sub) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const client = getSupabaseClient();
  const rolesResult = await client.db.getRoleAssignmentsByUserId(auth.sub);
  if (rolesResult.error) {
    return NextResponse.json({ success: false, message: rolesResult.error.message }, { status: 500 });
  }

  const founderRoleAssignments = rolesResult.data.filter(
    (assignment) => assignment.role === 'founder' && (assignment.scope === 'global' || assignment.scope === 'event')
  );

  if (founderRoleAssignments.length === 0) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const assignedEventIds = new Set(
    founderRoleAssignments
      .filter((assignment) => assignment.scope === 'event' && assignment.scoped_id)
      .map((assignment) => assignment.scoped_id as string)
  );

  const founderResult = await client.db.getFounderByUserId(auth.sub);
  if (founderResult.error) {
    return NextResponse.json({ success: false, message: founderResult.error.message }, { status: 500 });
  }

  const founderPitchesByEventId = new Map<string, FounderPitchRow>();
  if (founderResult.data) {
    const founderPitchesResult = await client.db.queryTable<FounderPitchRow>(
      'founder_pitches',
      `founder_id=eq.${encodeURIComponent(founderResult.data.id)}&select=id,event_id,pitch_deck_url,score_aggregate,score_breakdown&limit=500`
    );
    if (founderPitchesResult.error) {
      return NextResponse.json({ success: false, message: founderPitchesResult.error.message }, { status: 500 });
    }

    for (const pitch of founderPitchesResult.data) {
      assignedEventIds.add(pitch.event_id);
      if (!founderPitchesByEventId.has(pitch.event_id)) {
        founderPitchesByEventId.set(pitch.event_id, pitch);
      }
    }
  }

  const eventIds = Array.from(assignedEventIds);
  if (eventIds.length === 0) {
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }

  const eventsResult = await client.db.listEventsByIds(eventIds);
  if (eventsResult.error) {
    return NextResponse.json({ success: false, message: eventsResult.error.message }, { status: 500 });
  }

  const encodedEventIds = eventIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
  const judgeAssignmentsResult = await client.db.queryTable<JudgeAssignmentRow>(
    'role_assignments',
    `role=eq.judge&scope=eq.event&scoped_id=in.(${encodeURIComponent(encodedEventIds)})&select=scoped_id,user_id&limit=2000`
  );
  if (judgeAssignmentsResult.error) {
    return NextResponse.json({ success: false, message: judgeAssignmentsResult.error.message }, { status: 500 });
  }

  const judgeAssignmentsByEvent = new Map<string, string[]>();
  for (const assignment of judgeAssignmentsResult.data) {
    const existing = judgeAssignmentsByEvent.get(assignment.scoped_id) ?? [];
    existing.push(assignment.user_id);
    judgeAssignmentsByEvent.set(assignment.scoped_id, existing);
  }

  const pitchIds = Array.from(founderPitchesByEventId.values()).map((pitch) => pitch.id);
  const judgeScoreProgressByPitchId = new Map<string, { submitted: number; total: number }>();
  if (pitchIds.length > 0) {
    const encodedPitchIds = pitchIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
    const judgeScoresResult = await client.db.queryTable<JudgeScoreRow>(
      'judge_scores',
      `founder_pitch_id=in.(${encodeURIComponent(encodedPitchIds)})&select=founder_pitch_id,state&limit=5000`
    );
    if (judgeScoresResult.error) {
      return NextResponse.json({ success: false, message: judgeScoresResult.error.message }, { status: 500 });
    }

    for (const score of judgeScoresResult.data) {
      const existing = judgeScoreProgressByPitchId.get(score.founder_pitch_id) ?? { submitted: 0, total: 0 };
      existing.total += 1;
      if (score.state === 'submitted' || score.state === 'locked') {
        existing.submitted += 1;
      }
      judgeScoreProgressByPitchId.set(score.founder_pitch_id, existing);
    }
  }

  const now = new Date();
  return NextResponse.json(
    {
      success: true,
      data: eventsResult.data.map((event) => {
        const pitch = founderPitchesByEventId.get(event.id) ?? null;
        const assignedJudgeIds = judgeAssignmentsByEvent.get(event.id) ?? [];
        const scoreProgress = pitch
          ? (judgeScoreProgressByPitchId.get(pitch.id) ?? { submitted: 0, total: assignedJudgeIds.length })
          : { submitted: 0, total: assignedJudgeIds.length };

        const publishingStartDate = parseDate(event.publishing_start);
        const scoresPublished = publishingStartDate ? now >= publishingStartDate : false;

        return {
          id: event.id,
          name: event.name,
          status: event.status,
          start_date: event.start_date,
          end_date: event.end_date,
          scoring_start: event.scoring_start,
          scoring_end: event.scoring_end,
          publishing_start: event.publishing_start,
          publishing_end: event.publishing_end,
          scoring_window_open: isWithinScoringWindow(event.scoring_start, event.scoring_end, now),
          assigned_judges: assignedJudgeIds,
          pitch: pitch
            ? {
              id: pitch.id,
              pitch_deck_url: pitch.pitch_deck_url,
              score_aggregate: scoresPublished ? pitch.score_aggregate : null,
              score_breakdown: scoresPublished ? pitch.score_breakdown : null,
              score_progress: scoreProgress,
            }
            : null,
          scores_published: scoresPublished,
        };
      }),
    },
    { status: 200 }
  );
}
