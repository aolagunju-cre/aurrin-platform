import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoMentorMatches } from '@/src/lib/demo/data';
import { canAccessFounderEvent, requireFounderOrAdmin } from '../../../../../lib/auth/founder';
import { getSupabaseClient, type MentorMatchRecord } from '../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ matchId: string }>;
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

function isPublishingOpen(value: string | null): boolean {
  const parsed = parseDate(value);
  if (!parsed) {
    return false;
  }

  return Date.now() >= parsed.getTime();
}

async function loadFounderMatchOrError(matchId: string): Promise<{ match: MentorMatchRecord | null; error: NextResponse | null }> {
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
  if (matchResult.data.mentor_status !== 'accepted' || matchResult.data.founder_status !== 'accepted') {
    return {
      match: null,
      error: NextResponse.json({ success: false, message: 'Match not found.' }, { status: 404 }),
    };
  }
  return { match: matchResult.data, error: null };
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (DEMO_MODE) {
    const { matchId } = await params;
    const match = demoMentorMatches.find((m) => m.id === matchId);
    if (!match) {
      return NextResponse.json({ success: false, message: 'Match not found.' }, { status: 404 });
    }
    return NextResponse.json(
      {
        success: true,
        data: {
          id: match.id,
          event_id: null,
          created_at: match.matched_at,
          mentor_accepted_at: match.matched_at,
          founder_accepted_at: match.matched_at,
          mentor: { id: match.id, name: 'Demo Mentor', title: null, bio: null, expertise_areas: [match.industry], contact: { email: null } },
          event: null,
        },
      },
      { status: 200 }
    );
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { matchId } = await params;
  const { match, error } = await loadFounderMatchOrError(matchId);
  if (error || !match) {
    return error as NextResponse;
  }

  if (!authResult.isAdmin && match.founder_id !== authResult.founder?.id) {
    return NextResponse.json({ success: false, message: 'Match not found.' }, { status: 404 });
  }

  if (!authResult.isAdmin && match.event_id && !canAccessFounderEvent(authResult.roleAssignments, match.event_id)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const eventResult = match.event_id ? await client.db.getEventById(match.event_id) : { data: null, error: null };
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (match.event_id && !eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const published = isPublishingOpen(eventResult.data?.publishing_start ?? null);
  if (!authResult.isAdmin && !published) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const mentorResult = await client.db.getUserById(match.mentor_id);
  if (mentorResult.error) {
    return NextResponse.json({ success: false, message: mentorResult.error.message }, { status: 500 });
  }
  if (!mentorResult.data) {
    return NextResponse.json({ success: false, message: 'Mentor not found.' }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        id: match.id,
        event_id: match.event_id,
        created_at: match.created_at,
        mentor_accepted_at: match.mentor_accepted_at,
        founder_accepted_at: match.founder_accepted_at,
        mentor: {
          id: mentorResult.data.id,
          name: mentorResult.data.name,
          title: null,
          bio: null,
          expertise_areas: [] as string[],
          contact: {
            email: mentorResult.data.email,
          },
        },
        event: eventResult.data
          ? {
            id: eventResult.data.id,
            name: eventResult.data.name,
            publishing_start: eventResult.data.publishing_start,
            published,
          }
          : null,
      },
    },
    { status: 200 }
  );
}
