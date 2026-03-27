import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string; sessionId: string }>;
}

interface SubmitResponsePayload {
  founder_pitch_id?: string;
  responses?: Record<string, unknown>;
}

const DUPLICATE_MESSAGE = "You've already submitted feedback for this founder";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }
  const parsed = Date.parse(expiresAt);
  if (Number.isNaN(parsed)) {
    return false;
  }
  return parsed <= Date.now();
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { eventId, sessionId } = await params;
  const client = getSupabaseClient();

  const sessionResult = await client.db.getAudienceSessionById(sessionId);
  if (sessionResult.error) {
    return NextResponse.json({ success: false, message: sessionResult.error.message }, { status: 500 });
  }
  if (!sessionResult.data || sessionResult.data.event_id !== eventId) {
    return NextResponse.json({ success: false, message: 'Session not found.' }, { status: 404 });
  }

  if (isExpired(sessionResult.data.expires_at)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as SubmitResponsePayload | null;
  if (!payload || typeof payload.founder_pitch_id !== 'string' || !isRecord(payload.responses)) {
    return NextResponse.json(
      { success: false, message: 'Body must include founder_pitch_id and responses object.' },
      { status: 400 }
    );
  }

  if (Object.keys(payload.responses).length === 0) {
    return NextResponse.json(
      { success: false, message: 'responses must include at least one question answer.' },
      { status: 400 }
    );
  }

  const pitchResult = await client.db.getFounderPitchById(payload.founder_pitch_id);
  if (pitchResult.error) {
    return NextResponse.json({ success: false, message: pitchResult.error.message }, { status: 500 });
  }
  if (!pitchResult.data || pitchResult.data.event_id !== eventId) {
    return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
  }

  const existingResult = await client.db.getAudienceResponseBySessionAndFounderPitch(sessionId, payload.founder_pitch_id);
  if (existingResult.error) {
    return NextResponse.json({ success: false, message: existingResult.error.message }, { status: 500 });
  }
  if (existingResult.data) {
    return NextResponse.json({ success: false, message: DUPLICATE_MESSAGE }, { status: 409 });
  }

  if (sessionResult.data.ip_address) {
    const sameIpSessionsResult = await client.db.listAudienceSessionsByEventAndIp(
      eventId,
      sessionResult.data.ip_address,
      sessionId
    );
    if (sameIpSessionsResult.error) {
      return NextResponse.json({ success: false, message: sameIpSessionsResult.error.message }, { status: 500 });
    }
    if (sameIpSessionsResult.data.length > 0) {
      const ipDedupResult = await client.db.listAudienceResponsesByFounderPitchAndSessionIds(
        payload.founder_pitch_id,
        sameIpSessionsResult.data.map((session) => session.id)
      );
      if (ipDedupResult.error) {
        return NextResponse.json({ success: false, message: ipDedupResult.error.message }, { status: 500 });
      }
      if (ipDedupResult.data.length > 0) {
        return NextResponse.json({ success: false, message: DUPLICATE_MESSAGE }, { status: 409 });
      }
    }
  }

  if (sessionResult.data.email) {
    const sameEmailSessionsResult = await client.db.listAudienceSessionsByEventAndEmail(
      eventId,
      sessionResult.data.email,
      sessionId
    );
    if (sameEmailSessionsResult.error) {
      return NextResponse.json({ success: false, message: sameEmailSessionsResult.error.message }, { status: 500 });
    }
    if (sameEmailSessionsResult.data.length > 0) {
      const emailDedupResult = await client.db.listAudienceResponsesByFounderPitchAndSessionIds(
        payload.founder_pitch_id,
        sameEmailSessionsResult.data.map((session) => session.id)
      );
      if (emailDedupResult.error) {
        return NextResponse.json({ success: false, message: emailDedupResult.error.message }, { status: 500 });
      }
      if (emailDedupResult.data.length > 0) {
        return NextResponse.json({ success: false, message: DUPLICATE_MESSAGE }, { status: 409 });
      }
    }
  }

  const insertResult = await client.db.insertAudienceResponse({
    audience_session_id: sessionId,
    founder_pitch_id: payload.founder_pitch_id,
    responses: payload.responses,
  });

  if (insertResult.error) {
    const message = insertResult.error.message.toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      return NextResponse.json({ success: false, message: DUPLICATE_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Feedback submitted.' }, { status: 200 });
}
