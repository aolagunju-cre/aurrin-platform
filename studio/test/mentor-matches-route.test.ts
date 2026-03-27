/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as listMentorMatches } from '../src/app/api/mentor/matches/route';
import { GET as getMentorMatch, PATCH as patchMentorMatch } from '../src/app/api/mentor/matches/[matchId]/route';
import { requireMentor } from '../src/lib/auth/mentor';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/mentor', () => ({
  requireMentor: jest.fn(),
  canAccessMentorEvent: jest.fn(() => true),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireMentor = requireMentor as jest.MockedFunction<typeof requireMentor>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('mentor matches routes', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockedRequireMentor.mockResolvedValue({
      userId: 'mentor-user-1',
      auth: {
        sub: 'mentor-user-1',
        email: 'mentor@example.com',
        iat: 0,
        exp: 9999999999,
        aud: 'authenticated',
        iss: 'https://example.supabase.co/auth/v1',
      },
      roleAssignments: [
        {
          id: 'ra-1',
          user_id: 'mentor-user-1',
          role: 'mentor',
          scope: 'global',
          scoped_id: null,
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-03-27T00:00:00.000Z',
          created_by: null,
        },
      ],
    });

    mockDb = {
      queryTable: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'match-1',
            mentor_id: 'mentor-user-1',
            founder_id: 'founder-1',
            event_id: 'event-1',
            mentor_status: 'pending',
            founder_status: 'pending',
            mentor_accepted_at: null,
            founder_accepted_at: null,
            created_at: '2026-03-27T00:00:00.000Z',
            founder: {
              id: 'founder-1',
              company_name: 'Acme',
              bio: 'A short pitch summary',
              user: { id: 'user-founder-1', name: 'Founder One' },
            },
            event: {
              id: 'event-1',
              name: 'Mentor Night',
              status: 'live',
            },
          },
          {
            id: 'match-2',
            mentor_id: 'mentor-user-1',
            founder_id: 'founder-2',
            event_id: 'event-1',
            mentor_status: 'accepted',
            founder_status: 'accepted',
            mentor_accepted_at: '2026-03-27T00:10:00.000Z',
            founder_accepted_at: '2026-03-27T00:11:00.000Z',
            created_at: '2026-03-27T00:01:00.000Z',
            founder: {
              id: 'founder-2',
              company_name: 'Beta',
              bio: 'Another summary',
              user: { id: 'user-founder-2', name: 'Founder Two' },
            },
            event: {
              id: 'event-1',
              name: 'Mentor Night',
              status: 'live',
            },
          },
        ],
        error: null,
      }),
      getMentorMatchById: jest.fn().mockResolvedValue({
        data: {
          id: 'match-1',
          mentor_id: 'mentor-user-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'pending',
          founder_status: 'accepted',
          mentor_accepted_at: null,
          founder_accepted_at: '2026-03-27T00:10:00.000Z',
          declined_by: null,
          notes: null,
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-03-27T00:00:00.000Z',
        },
        error: null,
      }),
      updateMentorMatchById: jest.fn().mockResolvedValue({
        data: {
          id: 'match-1',
          mentor_id: 'mentor-user-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'accepted',
          founder_status: 'accepted',
          mentor_accepted_at: '2026-03-27T00:12:00.000Z',
          founder_accepted_at: '2026-03-27T00:10:00.000Z',
          declined_by: null,
          notes: null,
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-03-27T00:12:00.000Z',
        },
        error: null,
      }),
      getUserById: jest.fn().mockResolvedValue({
        data: { id: 'user-founder-1', email: 'founder@example.com', name: 'Founder One' },
        error: null,
      }),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });
  });

  it('returns 401 from list route when mentor auth fails', async () => {
    mockedRequireMentor.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await listMentorMatches(buildRequest('http://localhost/api/mentor/matches', 'GET'));
    expect(response.status).toBe(401);
  });

  it('lists mentor matches with pending and accepted counts', async () => {
    const response = await listMentorMatches(buildRequest('http://localhost/api/mentor/matches', 'GET'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.counts).toEqual({ pending: 1, accepted: 1 });
    expect(payload.data.matches).toHaveLength(2);
  });

  it('returns founder profile fields on detail route', async () => {
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [{ id: 'founder-1', user_id: 'user-founder-1', company_name: 'Acme', bio: 'Pitch summary text' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', score_aggregate: 91, score_breakdown: { market: 45, traction: 46 } }],
        error: null,
      });

    const response = await getMentorMatch(
      buildRequest('http://localhost/api/mentor/matches/match-1', 'GET'),
      { params: Promise.resolve({ matchId: 'match-1' }) }
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.founder).toEqual(
      expect.objectContaining({
        name: 'Founder One',
        company: 'Acme',
        pitch_summary: 'Pitch summary text',
      })
    );
    expect(payload.data.founder.scores.aggregate).toBe(91);
  });

  it('returns 400 for invalid patch action', async () => {
    const response = await patchMentorMatch(
      buildRequest('http://localhost/api/mentor/matches/match-1', 'PATCH', { action: 'approve' }),
      { params: Promise.resolve({ matchId: 'match-1' }) }
    );
    expect(response.status).toBe(400);
  });

  it('updates pending match to accepted and reports mutual acceptance', async () => {
    const response = await patchMentorMatch(
      buildRequest('http://localhost/api/mentor/matches/match-1', 'PATCH', { action: 'accept' }),
      { params: Promise.resolve({ matchId: 'match-1' }) }
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({ status: 'accepted', mutual_acceptance: true });
    expect(mockDb.updateMentorMatchById).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when repeating the same accepted action', async () => {
    mockDb.getMentorMatchById.mockResolvedValueOnce({
      data: {
        id: 'match-1',
        mentor_id: 'mentor-user-1',
        founder_id: 'founder-1',
        event_id: 'event-1',
        mentor_status: 'accepted',
        founder_status: 'accepted',
        mentor_accepted_at: '2026-03-27T00:12:00.000Z',
        founder_accepted_at: '2026-03-27T00:10:00.000Z',
        declined_by: null,
        notes: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:12:00.000Z',
      },
      error: null,
    });

    const response = await patchMentorMatch(
      buildRequest('http://localhost/api/mentor/matches/match-1', 'PATCH', { action: 'accept' }),
      { params: Promise.resolve({ matchId: 'match-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.updateMentorMatchById).not.toHaveBeenCalled();
  });

  it('returns 409 when changing a finalized match to a different action', async () => {
    mockDb.getMentorMatchById.mockResolvedValueOnce({
      data: {
        id: 'match-1',
        mentor_id: 'mentor-user-1',
        founder_id: 'founder-1',
        event_id: 'event-1',
        mentor_status: 'declined',
        founder_status: 'pending',
        mentor_accepted_at: null,
        founder_accepted_at: null,
        declined_by: 'mentor',
        notes: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:12:00.000Z',
      },
      error: null,
    });

    const response = await patchMentorMatch(
      buildRequest('http://localhost/api/mentor/matches/match-1', 'PATCH', { action: 'accept' }),
      { params: Promise.resolve({ matchId: 'match-1' }) }
    );

    expect(response.status).toBe(409);
  });

  it('returns 403 for mismatched mentor ownership', async () => {
    mockDb.getMentorMatchById.mockResolvedValueOnce({
      data: {
        id: 'match-2',
        mentor_id: 'another-mentor',
        founder_id: 'founder-1',
        event_id: 'event-1',
        mentor_status: 'pending',
        founder_status: 'pending',
        mentor_accepted_at: null,
        founder_accepted_at: null,
        declined_by: null,
        notes: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:12:00.000Z',
      },
      error: null,
    });

    const response = await patchMentorMatch(
      buildRequest('http://localhost/api/mentor/matches/match-2', 'PATCH', { action: 'accept' }),
      { params: Promise.resolve({ matchId: 'match-2' }) }
    );

    expect(response.status).toBe(403);
  });
});
