import { NextRequest, NextResponse } from 'next/server';
import { canAccessMentorEvent, requireMentor } from '../../../../../lib/auth/mentor';
import { getSupabaseClient, type MentorMatchRecord, type MentorMatchStatus } from '../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ matchId: string }>;
}

interface FounderRow {
  id: string;
  user_id: string;
  company_name: string | null;
  bio: string | null;
}

interface FounderPitchRow {
  id: string;
  score_aggregate: number | null;
  score_breakdown: Record<string, number> | null;
}

interface ActionBody {
  action?: unknown;
}

function isValidAction(value: unknown): value is 'accept' | 'decline' {
  return value === 'accept' || value === 'decline';
}

function toResponsePayload(match: MentorMatchRecord) {
  return {
    status: match.mentor_status,
    mutual_acceptance: match.mentor_status === 'accepted' && match.founder_status === 'accepted',
  };
}

function nextStatusFromAction(action: 'accept' | 'decline'): MentorMatchStatus {
  return action === 'accept' ? 'accepted' : 'declined';
}

async function loadMentorMatchOrError(matchId: string): Promise<{ match: MentorMatchRecord | null; error: NextResponse | null }> {
  const client = getSupabaseClient();
  const matchResult = await client.db.getMentorMatchById(matchId);
  if (matchResult.error) {
    return {
      match: null,
      error: NextResponse.json({ success: false, message: matchResult.error.message }, { status: 500 }),
    };
  }
  if (!matchResult.data) {
    return {
      match: null,
      error: NextResponse.json({ success: false, message: 'Match not found.' }, { status: 404 }),
    };
  }
  return { match: matchResult.data, error: null };
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireMentor(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { matchId } = await params;
  const { match, error } = await loadMentorMatchOrError(matchId);
  if (error || !match) {
    return error as NextResponse;
  }

  if (match.mentor_id !== authResult.userId || !canAccessMentorEvent(authResult.roleAssignments, match.event_id)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const founderResult = await client.db.queryTable<FounderRow>(
    'founders',
    `id=eq.${encodeURIComponent(match.founder_id)}&select=id,user_id,company_name,bio&limit=1`
  );
  if (founderResult.error) {
    return NextResponse.json({ success: false, message: founderResult.error.message }, { status: 500 });
  }

  const founder = founderResult.data[0] ?? null;
  if (!founder) {
    return NextResponse.json({ success: false, message: 'Founder not found.' }, { status: 404 });
  }

  const founderUserResult = await client.db.getUserById(founder.user_id);
  if (founderUserResult.error) {
    return NextResponse.json({ success: false, message: founderUserResult.error.message }, { status: 500 });
  }

  const eventFilter = match.event_id ? `&event_id=eq.${encodeURIComponent(match.event_id)}` : '';
  const founderPitchResult = await client.db.queryTable<FounderPitchRow>(
    'founder_pitches',
    `founder_id=eq.${encodeURIComponent(founder.id)}${eventFilter}&select=id,score_aggregate,score_breakdown&order=created_at.desc&limit=1`
  );
  if (founderPitchResult.error) {
    return NextResponse.json({ success: false, message: founderPitchResult.error.message }, { status: 500 });
  }
  const founderPitch = founderPitchResult.data[0] ?? null;

  return NextResponse.json(
    {
      success: true,
      data: {
        id: match.id,
        event_id: match.event_id,
        mentor_status: match.mentor_status,
        founder_status: match.founder_status,
        mentor_accepted_at: match.mentor_accepted_at,
        founder_accepted_at: match.founder_accepted_at,
        founder: {
          id: founder.id,
          name: founderUserResult.data?.name ?? null,
          company: founder.company_name,
          pitch_summary: founder.bio,
          scores: {
            aggregate: founderPitch?.score_aggregate ?? null,
            breakdown: founderPitch?.score_breakdown ?? null,
          },
        },
      },
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireMentor(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { matchId } = await params;
  const { match, error } = await loadMentorMatchOrError(matchId);
  if (error || !match) {
    return error as NextResponse;
  }

  if (match.mentor_id !== authResult.userId || !canAccessMentorEvent(authResult.roleAssignments, match.event_id)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isValidAction(body.action)) {
    return NextResponse.json(
      { success: false, message: 'action must be one of: accept, decline.' },
      { status: 400 }
    );
  }

  const desiredStatus = nextStatusFromAction(body.action);
  if (match.mentor_status === desiredStatus) {
    return NextResponse.json({ success: true, data: toResponsePayload(match) }, { status: 200 });
  }

  if (match.mentor_status !== 'pending') {
    return NextResponse.json(
      { success: false, message: 'Match is already finalized and cannot be changed.' },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const client = getSupabaseClient();
  const updateResult = await client.db.updateMentorMatchById(match.id, {
    mentor_status: desiredStatus,
    mentor_accepted_at: body.action === 'accept' ? nowIso : null,
    declined_by: body.action === 'decline' ? 'mentor' : null,
  });

  if (updateResult.error) {
    return NextResponse.json({ success: false, message: updateResult.error.message }, { status: 500 });
  }
  if (!updateResult.data) {
    return NextResponse.json({ success: false, message: 'Match not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: toResponsePayload(updateResult.data) }, { status: 200 });
}
