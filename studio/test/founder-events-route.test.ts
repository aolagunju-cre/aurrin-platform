/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getFounderEvents } from '../src/app/api/founder/events/route';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(authorization = 'Bearer token'): NextRequest {
  return new NextRequest(
    new Request('http://localhost/api/founder/events', {
      method: 'GET',
      headers: { authorization },
    })
  );
}

describe('GET /api/founder/events', () => {
  const mockDb = {
    getRoleAssignmentsByUserId: jest.fn(),
    getFounderByUserId: jest.fn(),
    queryTable: jest.fn(),
    listEventsByIds: jest.fn(),
  };

  beforeEach(() => {
    mockDb.getRoleAssignmentsByUserId.mockReset();
    mockDb.getFounderByUserId.mockReset();
    mockDb.queryTable.mockReset();
    mockDb.listEventsByIds.mockReset();
    mockedExtractTokenFromHeader.mockReset();
    mockedVerifyJWT.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockedExtractTokenFromHeader.mockReturnValue('token');
    mockedVerifyJWT.mockResolvedValue({
      sub: 'founder-user-1',
      email: 'founder@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });
  });

  it('returns 403 for non-founder users', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({
      data: [{ role: 'judge', scope: 'event', scoped_id: 'event-1' }],
      error: null,
    });

    const response = await getFounderEvents(buildRequest());
    expect(response.status).toBe(403);
  });

  it('returns assigned founder events and hides scores before publishing start', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({
      data: [{ role: 'founder', scope: 'event', scoped_id: 'event-1' }],
      error: null,
    });
    mockDb.getFounderByUserId.mockResolvedValueOnce({
      data: { id: 'founder-1', user_id: 'founder-user-1' },
      error: null,
    });

    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-1',
            event_id: 'event-1',
            pitch_deck_url: 'https://example.com/deck.pdf',
            score_aggregate: 88.4,
            score_breakdown: { Execution: 90 },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ scoped_id: 'event-1', user_id: 'judge-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ founder_pitch_id: 'pitch-1', state: 'submitted' }],
        error: null,
      });

    mockDb.listEventsByIds.mockResolvedValueOnce({
      data: [
        {
          id: 'event-1',
          name: 'Demo Day',
          status: 'live',
          start_date: '2026-04-01T10:00:00.000Z',
          end_date: '2026-04-01T12:00:00.000Z',
          scoring_start: '2026-04-01T10:10:00.000Z',
          scoring_end: '2026-04-01T11:50:00.000Z',
          publishing_start: '2999-04-01T12:30:00.000Z',
          publishing_end: '2999-04-02T12:30:00.000Z',
        },
      ],
      error: null,
    });

    const response = await getFounderEvents(buildRequest());
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.data[0].assigned_judges).toEqual(['judge-1']);
    expect(payload.data[0].pitch.score_progress).toEqual({ submitted: 1, total: 1 });
    expect(payload.data[0].scores_published).toBe(false);
    expect(payload.data[0].pitch.score_aggregate).toBeNull();
    expect(payload.data[0].pitch.score_breakdown).toBeNull();
  });

  it('returns published scores when publishing window has started', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({
      data: [{ role: 'founder', scope: 'event', scoped_id: 'event-2' }],
      error: null,
    });
    mockDb.getFounderByUserId.mockResolvedValueOnce({
      data: { id: 'founder-1', user_id: 'founder-user-1' },
      error: null,
    });

    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-2',
            event_id: 'event-2',
            pitch_deck_url: 'https://example.com/deck-2.pdf',
            score_aggregate: 91.2,
            score_breakdown: { Team: 92 },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    mockDb.listEventsByIds.mockResolvedValueOnce({
      data: [
        {
          id: 'event-2',
          name: 'Published Finals',
          status: 'archived',
          start_date: '2026-04-01T10:00:00.000Z',
          end_date: '2026-04-01T12:00:00.000Z',
          scoring_start: '2026-04-01T10:10:00.000Z',
          scoring_end: '2026-04-01T11:50:00.000Z',
          publishing_start: '2000-04-01T12:30:00.000Z',
          publishing_end: '2000-04-02T12:30:00.000Z',
        },
      ],
      error: null,
    });

    const response = await getFounderEvents(buildRequest());
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.data[0].scores_published).toBe(true);
    expect(payload.data[0].pitch.score_aggregate).toBe(91.2);
    expect(payload.data[0].pitch.score_breakdown).toEqual({ Team: 92 });
  });
});
