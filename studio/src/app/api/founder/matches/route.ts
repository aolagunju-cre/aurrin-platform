import { NextRequest, NextResponse } from 'next/server';
import { canAccessFounderEvent, requireFounderOrAdmin } from '../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../lib/db/client';

interface FounderMatchListRow {
  id: string;
  founder_id: string;
  mentor_id: string;
  event_id: string | null;
  mentor_status: 'pending' | 'accepted' | 'declined';
  founder_status: 'pending' | 'accepted' | 'declined';
  mentor_accepted_at: string | null;
  founder_accepted_at: string | null;
  created_at: string;
  mentor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  event: {
    id: string;
    name: string;
    publishing_start: string | null;
  } | null;
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let founderId = authResult.founder?.id ?? null;
  if (authResult.isAdmin && !founderId) {
    founderId = request.nextUrl.searchParams.get('founder_id');
    if (!founderId) {
      return NextResponse.json(
        { success: false, message: 'Admin requests must include founder_id query parameter.' },
        { status: 400 }
      );
    }
  }

  if (!founderId) {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  const client = getSupabaseClient();
  const select = [
    'id,founder_id,mentor_id,event_id,mentor_status,founder_status,mentor_accepted_at,founder_accepted_at,created_at,',
    'mentor:users!mentor_matches_mentor_id_fkey(id,name,email),',
    'event:events!mentor_matches_event_id_fkey(id,name,publishing_start)',
  ].join('');
  const query = [
    `founder_id=eq.${encodeURIComponent(founderId)}`,
    'mentor_status=eq.accepted',
    'founder_status=eq.accepted',
    `select=${encodeURIComponent(select)}`,
    'order=created_at.desc',
    'limit=500',
  ].join('&');

  const matchesResult = await client.db.queryTable<FounderMatchListRow>('mentor_matches', query);
  if (matchesResult.error) {
    return NextResponse.json({ success: false, message: matchesResult.error.message }, { status: 500 });
  }

  const visibleMatches = matchesResult.data.filter((match) => {
    if (authResult.isAdmin) {
      return true;
    }
    if (!match.event_id) {
      return false;
    }
    return canAccessFounderEvent(authResult.roleAssignments, match.event_id);
  }).filter((match) => {
    if (authResult.isAdmin) {
      return true;
    }
    return isPublishingOpen(match.event?.publishing_start ?? null);
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        matches: visibleMatches.map((match) => ({
          id: match.id,
          event_id: match.event_id,
          created_at: match.created_at,
          mentor_accepted_at: match.mentor_accepted_at,
          founder_accepted_at: match.founder_accepted_at,
          mentor: {
            id: match.mentor?.id ?? match.mentor_id,
            name: match.mentor?.name ?? null,
            title: null,
            bio: null,
            expertise_areas: [] as string[],
            contact: {
              email: match.mentor?.email ?? null,
            },
          },
          event: match.event
            ? {
              id: match.event.id,
              name: match.event.name,
              publishing_start: match.event.publishing_start,
              published: isPublishingOpen(match.event.publishing_start),
            }
            : null,
        })),
      },
    },
    { status: 200 }
  );
}
