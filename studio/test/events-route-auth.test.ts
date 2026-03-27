/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getEvent } from '../src/app/api/events/[id]/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;

function buildRequest(authorization?: string): NextRequest {
  const headers = new Headers();
  if (authorization) {
    headers.set('authorization', authorization);
  }

  return new NextRequest(
    new Request('http://localhost/api/events/event-1', {
      method: 'GET',
      headers,
    })
  );
}

describe('GET /api/events/[id]', () => {
  const mockDb = {
    getRoleAssignmentsByUserId: jest.fn(),
    getFounderByUserId: jest.fn(),
    queryTable: jest.fn(),
    getEventById: jest.fn(),
  };

  beforeEach(() => {
    mockedExtractTokenFromHeader.mockReset();
    mockedVerifyJWT.mockReset();
    mockDb.getRoleAssignmentsByUserId.mockReset();
    mockDb.getFounderByUserId.mockReset();
    mockDb.queryTable.mockReset();
    mockDb.getEventById.mockReset();

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });

    mockedExtractTokenFromHeader.mockReturnValue('token');
    mockedVerifyJWT.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });
    mockDb.getEventById.mockResolvedValue({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        description: null,
        status: 'live',
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        scoring_start: '2026-04-01T10:15:00.000Z',
        scoring_end: '2026-04-01T11:45:00.000Z',
        publishing_start: '2026-04-01T12:30:00.000Z',
        publishing_end: '2026-04-02T12:30:00.000Z',
        archived_at: null,
        starts_at: '2026-04-01T10:00:00.000Z',
        ends_at: '2026-04-01T12:00:00.000Z',
        config: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-03-25T00:00:00.000Z',
      },
      error: null,
    });
  });

  it('returns 401 when auth token is missing', async () => {
    mockedExtractTokenFromHeader.mockReturnValueOnce(null);

    const response = await getEvent(buildRequest(), { params: Promise.resolve({ id: 'event-1' }) });
    expect(response.status).toBe(401);
  });

  it('returns event details for assigned judge', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({
      data: [{ id: 'ra-judge', role: 'judge', scope: 'event', scoped_id: 'event-1' }],
      error: null,
    });

    const response = await getEvent(buildRequest('Bearer token'), { params: Promise.resolve({ id: 'event-1' }) });
    expect(response.status).toBe(200);
  });

  it('returns event details for assigned founder via founder pitch', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({
      data: [{ id: 'ra-founder', role: 'founder', scope: 'global', scoped_id: null }],
      error: null,
    });
    mockDb.getFounderByUserId.mockResolvedValueOnce({
      data: { id: 'founder-1', user_id: 'user-1' },
      error: null,
    });
    mockDb.queryTable.mockResolvedValueOnce({ data: [{ id: 'pitch-1' }], error: null });

    const response = await getEvent(buildRequest('Bearer token'), { params: Promise.resolve({ id: 'event-1' }) });
    expect(response.status).toBe(200);
  });

  it('returns 403 for users without event visibility', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({
      data: [{ id: 'ra-judge', role: 'judge', scope: 'event', scoped_id: 'event-2' }],
      error: null,
    });

    const response = await getEvent(buildRequest('Bearer token'), { params: Promise.resolve({ id: 'event-1' }) });
    expect(response.status).toBe(403);
  });
});
