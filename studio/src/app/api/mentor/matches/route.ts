import { NextRequest, NextResponse } from 'next/server';
import { canAccessMentorEvent, requireMentor } from '../../../../lib/auth/mentor';
import { getSupabaseClient } from '../../../../lib/db/client';

interface MentorMatchListRow {
  id: string;
  mentor_id: string;
  founder_id: string;
  event_id: string | null;
  mentor_status: 'pending' | 'accepted' | 'declined';
  founder_status: 'pending' | 'accepted' | 'declined';
  mentor_accepted_at: string | null;
  founder_accepted_at: string | null;
  created_at: string;
  founder: {
    id: string;
    company_name: string | null;
    bio: string | null;
    user: {
      id: string;
      name: string | null;
    } | null;
  } | null;
  event: {
    id: string;
    name: string;
    status: string;
  } | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireMentor(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const client = getSupabaseClient();
  const select = [
    'id,mentor_id,founder_id,event_id,mentor_status,founder_status,mentor_accepted_at,founder_accepted_at,created_at,',
    'founder:founders!mentor_matches_founder_id_fkey(id,company_name,bio,user:users!founders_user_id_fkey(id,name)),',
    'event:events!mentor_matches_event_id_fkey(id,name,status)',
  ].join('');
  const query = [
    `mentor_id=eq.${encodeURIComponent(authResult.userId)}`,
    `select=${encodeURIComponent(select)}`,
    'order=created_at.desc',
    'limit=500',
  ].join('&');

  const matchesResult = await client.db.queryTable<MentorMatchListRow>('mentor_matches', query);
  if (matchesResult.error) {
    return NextResponse.json({ success: false, message: matchesResult.error.message }, { status: 500 });
  }

  const visibleMatches = matchesResult.data.filter((match) => canAccessMentorEvent(authResult.roleAssignments, match.event_id));
  const pending = visibleMatches.filter((match) => match.mentor_status === 'pending').length;
  const accepted = visibleMatches.filter((match) => match.mentor_status === 'accepted').length;

  const eventMap = new Map<string, { id: string; name: string; status: string; pending: number; accepted: number }>();
  for (const match of visibleMatches) {
    if (!match.event) {
      continue;
    }
    const existing = eventMap.get(match.event.id) ?? {
      id: match.event.id,
      name: match.event.name,
      status: match.event.status,
      pending: 0,
      accepted: 0,
    };
    if (match.mentor_status === 'pending') {
      existing.pending += 1;
    }
    if (match.mentor_status === 'accepted') {
      existing.accepted += 1;
    }
    eventMap.set(match.event.id, existing);
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        counts: { pending, accepted },
        events: Array.from(eventMap.values()),
        matches: visibleMatches.map((match) => ({
          id: match.id,
          event_id: match.event_id,
          mentor_status: match.mentor_status,
          founder_status: match.founder_status,
          mentor_accepted_at: match.mentor_accepted_at,
          founder_accepted_at: match.founder_accepted_at,
          created_at: match.created_at,
          founder: {
            id: match.founder?.id ?? match.founder_id,
            name: match.founder?.user?.name ?? null,
            company: match.founder?.company_name ?? null,
            pitch_summary: match.founder?.bio ?? null,
          },
          event: match.event
            ? {
              id: match.event.id,
              name: match.event.name,
              status: match.event.status,
            }
            : null,
        })),
      },
    },
    { status: 200 }
  );
}
