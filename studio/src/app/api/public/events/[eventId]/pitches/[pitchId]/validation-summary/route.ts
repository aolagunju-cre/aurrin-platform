import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyJWT } from '../../../../../../../../lib/auth/jwt';
import { getSupabaseClient } from '../../../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string; pitchId: string }>;
}

interface AudienceResponseRow {
  responses: Record<string, unknown> | null;
}

interface QuestionAggregate {
  response_count: number;
  numeric_average: number | null;
  options: Record<string, number>;
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

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function isFounderRole(role: string, scope: string): boolean {
  return role === 'founder' && (scope === 'global' || scope === 'event');
}

function collectValidationQuestionIds(config: Record<string, unknown> | null): string[] {
  if (!config) {
    return [];
  }

  const rawQuestions =
    Array.isArray(config.validation_questions)
      ? config.validation_questions
      : Array.isArray(config.questions)
        ? config.questions
        : [];

  return rawQuestions
    .map((question) => {
      if (!question || typeof question !== 'object' || Array.isArray(question)) {
        return null;
      }
      const id = (question as Record<string, unknown>).id;
      return typeof id === 'string' && id.length > 0 ? id : null;
    })
    .filter((value): value is string => Boolean(value));
}

function buildPreviewSummary(questionIds: string[]): {
  total_responses: number;
  aggregate_score: number | null;
  breakdown_by_question: Record<string, QuestionAggregate>;
} {
  const breakdownByQuestion: Record<string, QuestionAggregate> = {};
  for (const questionId of questionIds) {
    breakdownByQuestion[questionId] = {
      response_count: 0,
      numeric_average: null,
      options: {},
    };
  }

  return {
    total_responses: 0,
    aggregate_score: null,
    breakdown_by_question: breakdownByQuestion,
  };
}

function buildLiveSummary(rows: AudienceResponseRow[]): {
  total_responses: number;
  aggregate_score: number | null;
  breakdown_by_question: Record<string, QuestionAggregate>;
} {
  const breakdownByQuestion: Record<
    string,
    { count: number; sum: number; numericCount: number; options: Record<string, number> }
  > = {};

  let totalNumericSum = 0;
  let totalNumericCount = 0;

  for (const row of rows) {
    if (!row.responses || typeof row.responses !== 'object' || Array.isArray(row.responses)) {
      continue;
    }

    for (const [questionId, answer] of Object.entries(row.responses)) {
      if (!breakdownByQuestion[questionId]) {
        breakdownByQuestion[questionId] = {
          count: 0,
          sum: 0,
          numericCount: 0,
          options: {},
        };
      }

      const questionAggregate = breakdownByQuestion[questionId];
      questionAggregate.count += 1;

      const numericAnswer = toNumber(answer);
      if (numericAnswer !== null) {
        questionAggregate.sum += numericAnswer;
        questionAggregate.numericCount += 1;
        totalNumericSum += numericAnswer;
        totalNumericCount += 1;
        continue;
      }

      if (typeof answer === 'string' || typeof answer === 'boolean') {
        const optionKey = String(answer);
        questionAggregate.options[optionKey] = (questionAggregate.options[optionKey] ?? 0) + 1;
      }
    }
  }

  const breakdown: Record<string, QuestionAggregate> = {};
  for (const [questionId, value] of Object.entries(breakdownByQuestion)) {
    breakdown[questionId] = {
      response_count: value.count,
      numeric_average: value.numericCount > 0 ? Number((value.sum / value.numericCount).toFixed(2)) : null,
      options: value.options,
    };
  }

  return {
    total_responses: rows.length,
    aggregate_score: totalNumericCount > 0 ? Number((totalNumericSum / totalNumericCount).toFixed(2)) : null,
    breakdown_by_question: breakdown,
  };
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { eventId, pitchId } = await params;

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

  const isAdmin = rolesResult.data.some((role) => role.role === 'admin' && role.scope === 'global');
  const hasFounderRole = rolesResult.data.some((role) => isFounderRole(role.role, role.scope));

  if (!isAdmin && !hasFounderRole) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const pitchResult = await client.db.getFounderPitchById(pitchId);
  if (pitchResult.error) {
    return NextResponse.json({ success: false, message: pitchResult.error.message }, { status: 500 });
  }
  if (!pitchResult.data || pitchResult.data.event_id !== eventId) {
    return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
  }

  const now = new Date();
  const publishingStart = parseDate(eventResult.data.publishing_start);
  const publishingOpen = publishingStart ? now >= publishingStart : false;

  if (!isAdmin && hasFounderRole) {
    const founderResult = await client.db.getFounderByUserId(auth.sub);
    if (founderResult.error) {
      return NextResponse.json({ success: false, message: founderResult.error.message }, { status: 500 });
    }
    if (!founderResult.data || founderResult.data.id !== pitchResult.data.founder_id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    if (!publishingOpen) {
      const previewEnabled = request.nextUrl.searchParams.get('preview') === 'true';
      if (!previewEnabled) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json(
        {
          ...buildPreviewSummary(collectValidationQuestionIds(eventResult.data.config)),
          preview_mode: true,
        },
        { status: 200 }
      );
    }
  }

  const responsesResult = await client.db.queryTable<AudienceResponseRow>(
    'audience_responses',
    `founder_pitch_id=eq.${encodeURIComponent(pitchId)}&select=responses&limit=5000`
  );
  if (responsesResult.error) {
    return NextResponse.json({ success: false, message: responsesResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ...buildLiveSummary(responsesResult.data),
      preview_mode: false,
    },
    { status: 200 }
  );
}
