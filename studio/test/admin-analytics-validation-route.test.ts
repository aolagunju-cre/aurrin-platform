/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getValidationSummary } from '../src/app/api/public/events/[eventId]/pitches/[pitchId]/validation-summary/route';
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

function buildRequest(path: string, authorization = 'Bearer token'): NextRequest {
  return new NextRequest(
    new Request(`http://localhost${path}`, {
      method: 'GET',
      headers: { authorization },
    })
  );
}

describe('GET /api/public/events/[eventId]/pitches/[pitchId]/validation-summary', () => {
  const mockDb = {
    getRoleAssignmentsByUserId: jest.fn(),
    getEventById: jest.fn(),
    getFounderPitchById: jest.fn(),
    getFounderByUserId: jest.fn(),
    queryTable: jest.fn(),
  };

  beforeEach(() => {
    Object.values(mockDb).forEach((fn) => fn.mockReset());
    mockedExtractTokenFromHeader.mockReset();
    mockedVerifyJWT.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockedExtractTokenFromHeader.mockReturnValue('token');
    mockedVerifyJWT.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
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

    mockDb.getEventById.mockResolvedValue({
      data: {
        id: 'event-1',
        publishing_start: '2000-01-01T00:00:00.000Z',
        config: {
          validation_questions: [{ id: 'q1' }, { id: 'q2' }],
        },
      },
      error: null,
    });

    mockDb.getFounderPitchById.mockResolvedValue({
      data: {
        id: 'pitch-1',
        event_id: 'event-1',
        founder_id: 'founder-1',
      },
      error: null,
    });

    mockDb.getFounderByUserId.mockResolvedValue({
      data: {
        id: 'founder-1',
      },
      error: null,
    });

    mockDb.queryTable.mockResolvedValue({
      data: [
        {
          responses: {
            q1: 5,
            q2: 'yes',
          },
        },
        {
          responses: {
            q1: 3,
            q2: 'no',
          },
        },
      ],
      error: null,
    });
  });

  it('allows admin access to live aggregates', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValue({
      data: [{ role: 'admin', scope: 'global', scoped_id: null }],
      error: null,
    });

    const response = await getValidationSummary(
      buildRequest('/api/public/events/event-1/pitches/pitch-1/validation-summary'),
      { params: Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-1' }) }
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.total_responses).toBe(2);
    expect(payload.aggregate_score).toBe(4);
    expect(payload.breakdown_by_question.q1.numeric_average).toBe(4);
    expect(payload.preview_mode).toBe(false);
  });

  it('blocks founder live access before publishing_start', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValue({
      data: [{ role: 'founder', scope: 'global', scoped_id: null }],
      error: null,
    });
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        publishing_start: '2999-01-01T00:00:00.000Z',
        config: {
          validation_questions: [{ id: 'q1' }],
        },
      },
      error: null,
    });

    const response = await getValidationSummary(
      buildRequest('/api/public/events/event-1/pitches/pitch-1/validation-summary'),
      { params: Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(403);
    expect(mockDb.queryTable).not.toHaveBeenCalled();
  });

  it('supports founder preview mode before publishing_start', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValue({
      data: [{ role: 'founder', scope: 'global', scoped_id: null }],
      error: null,
    });
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        publishing_start: '2999-01-01T00:00:00.000Z',
        config: {
          validation_questions: [{ id: 'q1' }, { id: 'q2' }],
        },
      },
      error: null,
    });

    const response = await getValidationSummary(
      buildRequest('/api/public/events/event-1/pitches/pitch-1/validation-summary?preview=true'),
      { params: Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-1' }) }
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.preview_mode).toBe(true);
    expect(payload.total_responses).toBe(0);
    expect(payload.aggregate_score).toBeNull();
    expect(payload.breakdown_by_question).toEqual({
      q1: { response_count: 0, numeric_average: null, options: {} },
      q2: { response_count: 0, numeric_average: null, options: {} },
    });
    expect(mockDb.queryTable).not.toHaveBeenCalled();
  });

  it('allows founder live aggregates after publishing_start', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValue({
      data: [{ role: 'founder', scope: 'global', scoped_id: null }],
      error: null,
    });

    const response = await getValidationSummary(
      buildRequest('/api/public/events/event-1/pitches/pitch-1/validation-summary'),
      { params: Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-1' }) }
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        total_responses: expect.any(Number),
        aggregate_score: expect.any(Number),
        breakdown_by_question: expect.any(Object),
      })
    );
  });
});
