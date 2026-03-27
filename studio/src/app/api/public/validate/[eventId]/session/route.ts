import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

interface CreateSessionPayload {
  email?: string;
  consent_given?: boolean;
  contact_opt_in?: boolean;
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) {
      return first.trim();
    }
  }

  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() || null;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { eventId } = await params;
  const client = getSupabaseClient();

  const eventResult = await client.db.getEventById(eventId);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  let payload: CreateSessionPayload = {};
  if (request.headers.get('content-length') !== '0') {
    payload = await request.json().catch(() => ({})) as CreateSessionPayload;
  }

  const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim().toLowerCase() : null;
  const consentGiven = payload.consent_given === true || payload.contact_opt_in === true;

  const insertResult = await client.db.insertAudienceSession({
    event_id: eventId,
    session_token: randomUUID(),
    ip_address: getClientIp(request),
    email,
    consent_given: consentGiven,
  });

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { success: false, message: insertResult.error?.message || 'Failed to create audience session.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      session_id: insertResult.data.id,
      event_id: insertResult.data.event_id,
      created_at: insertResult.data.created_at,
    },
    { status: 201 }
  );
}
