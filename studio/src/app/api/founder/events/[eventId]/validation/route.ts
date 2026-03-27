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
}

interface AudienceResponseRow {
  responses: Record<string, unknown> | null;
}

interface QuestionSummary {
  question_id: string;
  response_count: number;
  numeric_average: number | null;
  percentages: Record<string, number>;
  text_summary: string[];
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

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeOption(value: unknown): string | null {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildValidationSummary(rows: AudienceResponseRow[]): {
  total_responses: number;
  aggregate_score: number | null;
  by_question: QuestionSummary[];
} {
  const questionMap = new Map<
    string,
    {
      count: number;
      numericSum: number;
      numericCount: number;
      options: Map<string, number>;
      textResponses: string[];
    }
  >();

  let totalNumericSum = 0;
  let totalNumericCount = 0;

  for (const row of rows) {
    if (!row.responses || typeof row.responses !== 'object' || Array.isArray(row.responses)) {
      continue;
    }

    for (const [questionId, rawValue] of Object.entries(row.responses)) {
      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          count: 0,
          numericSum: 0,
          numericCount: 0,
          options: new Map<string, number>(),
          textResponses: [],
        });
      }

      const item = questionMap.get(questionId) as {
        count: number;
        numericSum: number;
        numericCount: number;
        options: Map<string, number>;
        textResponses: string[];
      };
      item.count += 1;

      if (isNumeric(rawValue)) {
        item.numericSum += rawValue;
        item.numericCount += 1;
        totalNumericSum += rawValue;
        totalNumericCount += 1;
        continue;
      }

      const normalized = normalizeOption(rawValue);
      if (normalized) {
        item.options.set(normalized, (item.options.get(normalized) ?? 0) + 1);
        if (typeof rawValue === 'string' && rawValue.trim().length > 20) {
          item.textResponses.push(rawValue.trim());
        }
      }
    }
  }

  const byQuestion: QuestionSummary[] = Array.from(questionMap.entries()).map(([questionId, value]) => {
    const percentages: Record<string, number> = {};
    for (const [option, count] of value.options.entries()) {
      percentages[option] = value.count === 0 ? 0 : Number(((count / value.count) * 100).toFixed(2));
    }

    return {
      question_id: questionId,
      response_count: value.count,
      numeric_average: value.numericCount > 0 ? Number((value.numericSum / value.numericCount).toFixed(2)) : null,
      percentages,
      text_summary: value.textResponses.slice(0, 3),
    };
  });

  return {
    total_responses: rows.length,
    aggregate_score: totalNumericCount > 0 ? Number((totalNumericSum / totalNumericCount).toFixed(2)) : null,
    by_question: byQuestion.sort((a, b) => a.question_id.localeCompare(b.question_id)),
  };
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (DEMO_MODE) {
    const { eventId } = await params;
    return NextResponse.json(
      {
        success: true,
        data: {
          founder_id: demoFounderProfile.id,
          event_id: eventId,
          publishing_start: null,
          published: true,
          summary: { total_responses: 0, aggregate_score: null, by_question: [] },
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
      `event_id=eq.${encodeURIComponent(eventId)}&founder_id=eq.${encodeURIComponent(authResult.founder.id)}&select=id,founder_id&limit=1`
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
      `event_id=eq.${encodeURIComponent(eventId)}&founder_id=eq.${encodeURIComponent(founderId)}&select=id,founder_id&limit=1`
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

  const responsesResult = await client.db.queryTable<AudienceResponseRow>(
    'audience_responses',
    `founder_pitch_id=eq.${encodeURIComponent(pitch.id)}&select=responses&limit=5000`
  );
  if (responsesResult.error) {
    return NextResponse.json({ success: false, message: responsesResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        founder_id: pitch.founder_id,
        event_id: eventId,
        publishing_start: eventResult.data.publishing_start,
        published,
        summary: buildValidationSummary(responsesResult.data),
      },
    },
    { status: 200 }
  );
}
