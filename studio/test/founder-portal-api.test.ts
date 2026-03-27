/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getFounderProfile, PATCH as patchFounderProfile } from '../src/app/api/founder/profile/route';
import { GET as getFounderPitch } from '../src/app/api/founder/events/[eventId]/pitch/route';
import { GET as getFounderScores } from '../src/app/api/founder/events/[eventId]/scores/route';
import { GET as getFounderValidation } from '../src/app/api/founder/events/[eventId]/validation/route';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/founder', () => ({
  requireFounderOrAdmin: jest.fn(),
  canAccessFounderEvent: jest.fn((roleAssignments, eventId: string) =>
    roleAssignments.some(
      (assignment: { role: string; scope: string; scoped_id: string | null }) =>
        assignment.role === 'founder' &&
        (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
    )
  ),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireFounderOrAdmin = requireFounderOrAdmin as jest.MockedFunction<typeof requireFounderOrAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json', authorization: 'Bearer founder-token' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('founder portal API routes', () => {
  let mockDb: Record<string, jest.Mock>;

  const founderContext = {
    userId: 'user-founder-1',
    auth: {
      sub: 'user-founder-1',
      email: 'founder@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    },
    founder: {
      id: 'founder-1',
      user_id: 'user-founder-1',
      company_name: 'Aurrin Labs',
      tagline: null,
      bio: 'Pitch summary',
      website: 'https://aurrin.example',
      pitch_deck_url: 'https://aurrin.example/deck.pdf',
      social_proof: { contact_preferences: { email_notifications: true } },
      created_at: '2026-03-27T00:00:00.000Z',
      updated_at: '2026-03-27T00:00:00.000Z',
    },
    roleAssignments: [
      {
        id: 'ra-1',
        user_id: 'user-founder-1',
        role: 'founder',
        scope: 'event',
        scoped_id: 'event-1',
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
        created_by: null,
      },
    ],
    isAdmin: false,
    isFounder: true,
  };

  beforeEach(() => {
    mockedRequireFounderOrAdmin.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockDb = {
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      updateFounder: jest.fn(),
      getFounderByUserId: jest.fn(),
      getEventById: jest.fn(),
      queryTable: jest.fn(),
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

  it('returns 401 when auth guard rejects profile GET', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await getFounderProfile(buildRequest('http://localhost/api/founder/profile', 'GET'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when founder tries to access a non-assigned event pitch', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      ...founderContext,
      roleAssignments: [
        {
          ...founderContext.roleAssignments[0],
          scoped_id: 'event-2',
        },
      ],
    });
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        status: 'live',
        scoring_start: '2026-03-27T00:00:00.000Z',
        scoring_end: '2026-03-27T01:00:00.000Z',
        publishing_start: '2026-03-28T00:00:00.000Z',
        publishing_end: '2026-03-29T00:00:00.000Z',
      },
      error: null,
    });

    const response = await getFounderPitch(buildRequest('http://localhost/api/founder/events/event-1/pitch', 'GET'), {
      params: Promise.resolve({ eventId: 'event-1' }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 403 for founder score requests before publishing window', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        publishing_start: '2999-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockDb.queryTable.mockResolvedValueOnce({
      data: [{ id: 'pitch-1', founder_id: 'founder-1', score_aggregate: 88.2, score_breakdown: { Team: 90 } }],
      error: null,
    });

    const response = await getFounderScores(buildRequest('http://localhost/api/founder/events/event-1/scores', 'GET'), {
      params: Promise.resolve({ eventId: 'event-1' }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 403 for founder validation requests before publishing window', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        publishing_start: '2999-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockDb.queryTable.mockResolvedValueOnce({
      data: [{ id: 'pitch-1', founder_id: 'founder-1' }],
      error: null,
    });

    const response = await getFounderValidation(
      buildRequest('http://localhost/api/founder/events/event-1/validation', 'GET'),
      {
        params: Promise.resolve({ eventId: 'event-1' }),
      }
    );

    expect(response.status).toBe(403);
  });

  it('returns published score breakdown for founder after publishing start', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        publishing_start: '2000-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', founder_id: 'founder-1', score_aggregate: 88.2, score_breakdown: { Team: 90 } }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            judge_id: 'judge-1',
            total_score: 89,
            category_scores: { Team: 90 },
            comments: 'Strong execution.',
            state: 'submitted',
            submitted_at: '2026-03-27T00:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'judge-1', name: 'Judge One', email: 'judge1@example.com' }],
        error: null,
      });

    const response = await getFounderScores(buildRequest('http://localhost/api/founder/events/event-1/scores', 'GET'), {
      params: Promise.resolve({ eventId: 'event-1' }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.aggregate.total_score).toBe(88.2);
    expect(payload.data.per_judge).toEqual([
      expect.objectContaining({
        judge_id: 'judge-1',
        judge_name: 'Judge One',
        total_score: 89,
      }),
    ]);
  });

  it('returns published validation summary for founder after publishing start', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        publishing_start: '2000-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', founder_id: 'founder-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { responses: { invest: 'yes', confidence: 4, notes: 'Great team and clear traction.' } },
          { responses: { invest: 'no', confidence: 2, notes: 'Need more customer proof.' } },
        ],
        error: null,
      });

    const response = await getFounderValidation(
      buildRequest('http://localhost/api/founder/events/event-1/validation', 'GET'),
      {
        params: Promise.resolve({ eventId: 'event-1' }),
      }
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.summary.total_responses).toBe(2);
    expect(payload.data.summary.aggregate_score).toBe(3);
    expect(payload.data.summary.by_question).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ question_id: 'invest', percentages: { yes: 50, no: 50 } }),
        expect.objectContaining({ question_id: 'confidence', numeric_average: 3 }),
      ])
    );
  });

  it('allows admin to read scores before publishing window with founder_id override', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      ...founderContext,
      founder: null,
      roleAssignments: [
        {
          id: 'ra-admin',
          user_id: 'admin-1',
          role: 'admin',
          scope: 'global',
          scoped_id: null,
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-03-27T00:00:00.000Z',
          created_by: null,
        },
      ],
      isAdmin: true,
      isFounder: false,
    });
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        publishing_start: '2999-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', founder_id: 'founder-1', score_aggregate: 80, score_breakdown: { Team: 80 } }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const response = await getFounderScores(
      buildRequest('http://localhost/api/founder/events/event-1/scores?founder_id=founder-1', 'GET'),
      {
        params: Promise.resolve({ eventId: 'event-1' }),
      }
    );

    expect(response.status).toBe(200);
  });

  it('returns founder profile data on GET', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.getUserById.mockResolvedValueOnce({
      data: {
        id: 'user-founder-1',
        email: 'founder@example.com',
        name: 'Founder One',
      },
      error: null,
    });

    const response = await getFounderProfile(buildRequest('http://localhost/api/founder/profile', 'GET'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toEqual(
      expect.objectContaining({
        founder_id: 'founder-1',
        name: 'Founder One',
        pitch_summary: 'Pitch summary',
      })
    );
  });

  it('updates founder profile fields on PATCH', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.updateUser.mockResolvedValueOnce({ data: { id: 'user-founder-1', name: 'Updated Founder' }, error: null });
    mockDb.updateFounder.mockResolvedValueOnce({ data: { id: 'founder-1' }, error: null });
    mockDb.getFounderByUserId.mockResolvedValueOnce({
      data: {
        ...founderContext.founder,
        company_name: 'Updated Co',
        bio: 'Updated summary',
        pitch_deck_url: 'https://aurrin.example/deck-v2.pdf',
        social_proof: { contact_preferences: { email_notifications: false } },
      },
      error: null,
    });
    mockDb.getUserById.mockResolvedValueOnce({
      data: {
        id: 'user-founder-1',
        email: 'founder@example.com',
        name: 'Updated Founder',
      },
      error: null,
    });

    const response = await patchFounderProfile(buildRequest('http://localhost/api/founder/profile', 'PATCH', {
      name: 'Updated Founder',
      company_name: 'Updated Co',
      pitch_summary: 'Updated summary',
      deck_url: 'https://aurrin.example/deck-v2.pdf',
      contact_preferences: { email_notifications: false },
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toEqual(
      expect.objectContaining({
        name: 'Updated Founder',
        company_name: 'Updated Co',
        pitch_summary: 'Updated summary',
        deck_url: 'https://aurrin.example/deck-v2.pdf',
      })
    );
  });
});
