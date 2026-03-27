import { NextRequest, NextResponse } from 'next/server';
import { canAccessEvent, requireJudge } from '../../../../../../lib/auth/judge';
import { getSupabaseClient, type JudgeScoreRecord, type JudgeScoreState } from '../../../../../../lib/db/client';
import { ensureScoringWindowOpen } from '../../../../../../lib/events/lifecycle';
import { calculateTotals } from '../../../../../../lib/scoring/calculate';

interface RouteParams {
  params: Promise<{ pitchId: string }>;
}

interface ScorePayload {
  responses?: Record<string, unknown>;
  comments?: string;
  state?: JudgeScoreState;
  updated_at?: string;
}

const CONFLICT_MESSAGE = 'This score was updated elsewhere';

function buildScoreResponse(score: JudgeScoreRecord): {
  score_id: string;
  total_score: number | null;
  breakdown: Record<string, unknown>;
  state: JudgeScoreState;
} {
  return {
    score_id: score.id,
    total_score: score.total_score,
    breakdown: score.category_scores ?? {},
    state: score.state,
  };
}

function sameScorePayload(
  existing: JudgeScoreRecord,
  payload: ScorePayload,
  total: number,
  breakdown: Record<string, unknown>
): boolean {
  const existingResponses = JSON.stringify(existing.responses ?? {});
  const nextResponses = JSON.stringify(payload.responses ?? {});
  const existingBreakdown = JSON.stringify(existing.category_scores ?? {});
  const nextBreakdown = JSON.stringify(breakdown ?? {});
  const existingComments = existing.comments ?? '';
  const nextComments = payload.comments ?? '';

  return (
    existing.state === 'submitted' &&
    payload.state === 'submitted' &&
    existingResponses === nextResponses &&
    existingBreakdown === nextBreakdown &&
    existingComments === nextComments &&
    Number(existing.total_score ?? 0) === Number(total)
  );
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

  const scoreResult = await client.db.getJudgeScoreByJudgeAndPitch(authResult.userId, pitchId);
  if (scoreResult.error) {
    return NextResponse.json({ success: false, message: scoreResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: scoreResult.data
        ? {
          ...buildScoreResponse(scoreResult.data),
          comments: scoreResult.data.comments,
          responses: scoreResult.data.responses,
          created_at: scoreResult.data.created_at,
          submitted_at: scoreResult.data.submitted_at,
          locked_at: scoreResult.data.locked_at,
          updated_at: scoreResult.data.updated_at,
        }
        : null,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireJudge(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { pitchId } = await params;

  let body: ScorePayload;
  try {
    body = await request.json() as ScorePayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.responses || typeof body.responses !== 'object' || Array.isArray(body.responses)) {
    return NextResponse.json({ success: false, message: 'responses must be an object.' }, { status: 400 });
  }

  if (typeof body.comments !== 'string') {
    return NextResponse.json({ success: false, message: 'comments must be a string.' }, { status: 400 });
  }

  if (body.state !== 'draft' && body.state !== 'submitted') {
    return NextResponse.json({ success: false, message: 'state must be one of: draft, submitted.' }, { status: 400 });
  }

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

  const eventResult = await client.db.getEventById(pitchResult.data.event_id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const windowCheck = ensureScoringWindowOpen(eventResult.data);
  if (!windowCheck.ok) {
    return NextResponse.json({ success: false, message: windowCheck.message }, { status: 400 });
  }

  const rubricResult = await client.db.getLatestRubricVersionByEventId(pitchResult.data.event_id);
  if (rubricResult.error) {
    return NextResponse.json({ success: false, message: rubricResult.error.message }, { status: 500 });
  }
  if (!rubricResult.data) {
    return NextResponse.json({ success: false, message: 'Rubric not configured for this event.' }, { status: 404 });
  }

  const totals = calculateTotals(body.responses, rubricResult.data);
  if (totals.breakdown.missing_required.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message: 'Required rubric responses are missing.',
        missing_required: totals.breakdown.missing_required,
      },
      { status: 400 }
    );
  }

  const scoreResult = await client.db.getJudgeScoreByJudgeAndPitch(authResult.userId, pitchId);
  if (scoreResult.error) {
    return NextResponse.json({ success: false, message: scoreResult.error.message }, { status: 500 });
  }

  const nextState: JudgeScoreState = body.state;
  const nextSubmittedAt = nextState === 'submitted' ? new Date().toISOString() : null;

  if (scoreResult.data) {
    const existing = scoreResult.data;

    if (typeof body.updated_at === 'string' && existing.updated_at !== body.updated_at) {
      return NextResponse.json({ success: false, message: CONFLICT_MESSAGE }, { status: 409 });
    }

    if (existing.state === 'locked') {
      return NextResponse.json({ success: false, message: 'Score is locked and cannot be modified.' }, { status: 409 });
    }

    if (existing.state === 'submitted') {
      if (sameScorePayload(existing, body, totals.total, totals.by_category)) {
        return NextResponse.json({ success: true, data: buildScoreResponse(existing) }, { status: 200 });
      }
      return NextResponse.json({ success: false, message: 'Score has already been submitted.' }, { status: 409 });
    }

    const updatedResult = await client.db.updateJudgeScore(existing.id, {
      responses: body.responses,
      comments: body.comments,
      total_score: totals.total,
      category_scores: totals.by_category,
      state: nextState,
      submitted_at: nextSubmittedAt,
      locked_at: existing.locked_at,
      rubric_version_id: rubricResult.data.id,
      founder_pitch_id: pitchId,
      judge_id: authResult.userId,
    });

    if (updatedResult.error || !updatedResult.data) {
      return NextResponse.json(
        { success: false, message: updatedResult.error?.message || 'Failed to update score.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: buildScoreResponse(updatedResult.data) }, { status: 200 });
  }

  const insertResult = await client.db.insertJudgeScore({
    judge_id: authResult.userId,
    founder_pitch_id: pitchId,
    rubric_version_id: rubricResult.data.id,
    responses: body.responses,
    comments: body.comments,
    total_score: totals.total,
    category_scores: totals.by_category,
    state: nextState,
    submitted_at: nextSubmittedAt,
    locked_at: null,
  });

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { success: false, message: insertResult.error?.message || 'Failed to save score.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: buildScoreResponse(insertResult.data) }, { status: 200 });
}
