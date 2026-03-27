/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST as createSession } from '../src/app/api/public/validate/[eventId]/session/route';
import { POST as submitResponse } from '../src/app/api/public/validate/[eventId]/session/[sessionId]/response/route';
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

type StoredResponse = {
  audience_session_id: string;
  founder_pitch_id: string;
  responses: Record<string, unknown>;
};

describe('Audience validation QR-to-submit-to-aggregate contract', () => {
  const storedResponses: StoredResponse[] = [];

  const mockDb = {
    getEventById: jest.fn(),
    insertAudienceSession: jest.fn(),
    getAudienceSessionById: jest.fn(),
    getFounderPitchById: jest.fn(),
    getAudienceResponseBySessionAndFounderPitch: jest.fn(),
    listAudienceSessionsByEventAndIp: jest.fn(),
    listAudienceSessionsByEventAndEmail: jest.fn(),
    listAudienceResponsesByFounderPitchAndSessionIds: jest.fn(),
    insertAudienceResponse: jest.fn(),
    getRoleAssignmentsByUserId: jest.fn(),
    getFounderByUserId: jest.fn(),
    queryTable: jest.fn(),
  };

  beforeEach(() => {
    storedResponses.length = 0;
    Object.values(mockDb).forEach((fn) => fn.mockReset());
    mockedExtractTokenFromHeader.mockReset();
    mockedVerifyJWT.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockedExtractTokenFromHeader.mockReturnValue('token');
    mockedVerifyJWT.mockResolvedValue({
      sub: 'admin-user',
      email: 'admin@example.com',
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
        name: 'Demo Day',
        config: {
          validation_questions: [
            { id: 'q1', type: 'rating', prompt: 'Product-market fit?' },
            { id: 'q2', type: 'yes_no', prompt: 'Would you invest?' },
          ],
        },
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        publishing_start: '2000-01-01T00:00:00.000Z',
      },
      error: null,
    });

    mockDb.insertAudienceSession.mockResolvedValue({
      data: {
        id: 'session-1',
        event_id: 'event-1',
        session_token: 'token-1',
        ip_address: '127.0.0.1',
        email: 'audience@example.com',
        consent_given: true,
        created_at: '2026-04-01T10:00:00.000Z',
        expires_at: '2126-04-02T10:00:00.000Z',
      },
      error: null,
    });

    mockDb.getAudienceSessionById.mockResolvedValue({
      data: {
        id: 'session-1',
        event_id: 'event-1',
        session_token: 'token-1',
        ip_address: '127.0.0.1',
        email: 'audience@example.com',
        consent_given: true,
        created_at: '2026-04-01T10:00:00.000Z',
        expires_at: '2126-04-02T10:00:00.000Z',
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

    mockDb.getAudienceResponseBySessionAndFounderPitch.mockImplementation(
      async (sessionId: string, founderPitchId: string) => {
        const found = storedResponses.find(
          (row) => row.audience_session_id === sessionId && row.founder_pitch_id === founderPitchId
        );
        return { data: found ?? null, error: null };
      }
    );

    mockDb.listAudienceSessionsByEventAndIp.mockResolvedValue({ data: [], error: null });
    mockDb.listAudienceSessionsByEventAndEmail.mockResolvedValue({ data: [], error: null });
    mockDb.listAudienceResponsesByFounderPitchAndSessionIds.mockResolvedValue({ data: [], error: null });

    mockDb.insertAudienceResponse.mockImplementation(async (input: StoredResponse) => {
      storedResponses.push(input);
      return { data: { id: `resp-${storedResponses.length}` }, error: null };
    });

    mockDb.getRoleAssignmentsByUserId.mockResolvedValue({
      data: [{ role: 'admin', scope: 'global', scoped_id: null }],
      error: null,
    });

    mockDb.getFounderByUserId.mockResolvedValue({ data: null, error: null });

    mockDb.queryTable.mockImplementation(async () => ({
      data: storedResponses.map((row) => ({ responses: row.responses })),
      error: null,
    }));
  });

  it('covers session creation, successful submit, duplicate 409, and admin aggregate response contract', async () => {
    const createRequest = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({ email: 'audience@example.com', consent_given: true }),
      })
    );

    const createResponse = await createSession(createRequest, { params: Promise.resolve({ eventId: 'event-1' }) });
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody).toEqual({
      session_id: 'session-1',
      event_id: 'event-1',
      created_at: '2026-04-01T10:00:00.000Z',
    });

    const submitRequest = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5, q2: 'yes' } }),
      })
    );

    const submitResponseResult = await submitResponse(submitRequest, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });

    expect(submitResponseResult.status).toBe(200);
    await expect(submitResponseResult.json()).resolves.toEqual({ success: true, message: 'Feedback submitted.' });

    const duplicateRequest = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5, q2: 'yes' } }),
      })
    );

    const duplicateResponse = await submitResponse(duplicateRequest, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const duplicateBody = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateBody.message).toBe("You've already submitted feedback for this founder");

    const summaryResponse = await getValidationSummary(
      new NextRequest(
        new Request('http://localhost/api/public/events/event-1/pitches/pitch-1/validation-summary', {
          method: 'GET',
          headers: { authorization: 'Bearer token' },
        })
      ),
      { params: Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-1' }) }
    );

    const summaryBody = await summaryResponse.json();

    expect(summaryResponse.status).toBe(200);
    expect(summaryBody).toEqual(
      expect.objectContaining({
        total_responses: 1,
        aggregate_score: 5,
        preview_mode: false,
      })
    );
    expect(summaryBody.breakdown_by_question).toEqual({
      q1: { response_count: 1, numeric_average: 5, options: {} },
      q2: { response_count: 1, numeric_average: null, options: { yes: 1 } },
    });
  });
});
