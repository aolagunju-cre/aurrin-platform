import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string; sessionId: string }>;
}

function extractValidationQuestions(config: Record<string, unknown> | null): unknown[] {
  if (!config) {
    return [];
  }

  const validationQuestions = config.validation_questions;
  if (Array.isArray(validationQuestions)) {
    return validationQuestions;
  }

  const questions = config.questions;
  if (Array.isArray(questions)) {
    return questions;
  }

  return [];
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { eventId, sessionId } = await params;
  const client = getSupabaseClient();

  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const sessionResult = await client.db.getAudienceSessionById(sessionId);
  if (sessionResult.error) {
    return NextResponse.json({ success: false, message: sessionResult.error.message }, { status: 500 });
  }
  if (!sessionResult.data || sessionResult.data.event_id !== eventId) {
    return NextResponse.json({ success: false, message: 'Session not found.' }, { status: 404 });
  }

  if (sessionResult.data.expires_at && Date.parse(sessionResult.data.expires_at) <= Date.now()) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const pitchesResult = await client.db.listFounderPitchesByEventId(eventId);
  if (pitchesResult.error) {
    return NextResponse.json({ success: false, message: pitchesResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        session: {
          id: sessionResult.data.id,
          event_id: sessionResult.data.event_id,
          created_at: sessionResult.data.created_at,
          expires_at: sessionResult.data.expires_at,
        },
        event: {
          id: eventResult.data.id,
          name: eventResult.data.name,
          start_date: eventResult.data.start_date,
          end_date: eventResult.data.end_date,
        },
        questions: extractValidationQuestions(eventResult.data.config),
        founder_pitches: pitchesResult.data.map((pitch) => ({
          id: pitch.id,
          founder_id: pitch.founder_id,
          pitch_order: pitch.pitch_order,
          company_name: pitch.founder?.company_name ?? null,
        })),
      },
    },
    { status: 200 }
  );
}
