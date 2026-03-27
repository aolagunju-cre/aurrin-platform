/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST as createSession } from '../src/app/api/public/validate/[eventId]/session/route';
import { GET as getSession } from '../src/app/api/public/validate/[eventId]/session/[sessionId]/route';
import { POST as submitResponse } from '../src/app/api/public/validate/[eventId]/session/[sessionId]/response/route';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('Public validation session APIs', () => {
  const mockDb = {
    getEventById: jest.fn(),
    insertAudienceSession: jest.fn(),
    getAudienceSessionById: jest.fn(),
    listFounderPitchesByEventId: jest.fn(),
    getFounderPitchById: jest.fn(),
    getAudienceResponseBySessionAndFounderPitch: jest.fn(),
    listAudienceSessionsByEventAndIp: jest.fn(),
    listAudienceResponsesByFounderPitchAndSessionIds: jest.fn(),
    listAudienceSessionsByEventAndEmail: jest.fn(),
    insertAudienceResponse: jest.fn(),
  };

  beforeEach(() => {
    Object.values(mockDb).forEach((fn) => fn.mockReset());

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
          validation_questions: [{ id: 'q1', type: 'rating', prompt: 'Would you invest?' }],
        },
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
      },
      error: null,
    });

    mockDb.insertAudienceSession.mockResolvedValue({
      data: {
        id: 'session-1',
        event_id: 'event-1',
        session_token: 'token-1',
        ip_address: '127.0.0.1',
        email: 'guest@example.com',
        consent_given: true,
        created_at: '2026-04-01T10:00:00.000Z',
        expires_at: '2026-04-02T10:00:00.000Z',
      },
      error: null,
    });

    mockDb.getAudienceSessionById.mockResolvedValue({
      data: {
        id: 'session-1',
        event_id: 'event-1',
        session_token: 'token-1',
        ip_address: '127.0.0.1',
        email: 'guest@example.com',
        consent_given: true,
        created_at: '2026-04-01T10:00:00.000Z',
        expires_at: '2126-04-02T10:00:00.000Z',
      },
      error: null,
    });

    mockDb.listFounderPitchesByEventId.mockResolvedValue({
      data: [{ id: 'pitch-1', founder_id: 'founder-1', pitch_order: 1, founder: { company_name: 'Acme' } }],
      error: null,
    });

    mockDb.getFounderPitchById.mockResolvedValue({
      data: { id: 'pitch-1', event_id: 'event-1' },
      error: null,
    });

    mockDb.getAudienceResponseBySessionAndFounderPitch.mockResolvedValue({ data: null, error: null });
    mockDb.listAudienceSessionsByEventAndIp.mockResolvedValue({ data: [], error: null });
    mockDb.listAudienceSessionsByEventAndEmail.mockResolvedValue({ data: [], error: null });
    mockDb.listAudienceResponsesByFounderPitchAndSessionIds.mockResolvedValue({ data: [], error: null });
    mockDb.insertAudienceResponse.mockResolvedValue({ data: { id: 'resp-1' }, error: null });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a validation session and returns required response fields', async () => {
    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({ email: 'guest@example.com', consent_given: true }),
      })
    );

    const response = await createSession(request, { params: Promise.resolve({ eventId: 'event-1' }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      session_id: 'session-1',
      event_id: 'event-1',
      created_at: '2026-04-01T10:00:00.000Z',
    });
  });

  it('returns active session with event questions payload', async () => {
    const request = new NextRequest(new Request('http://localhost/api/public/validate/event-1/session/session-1'));
    const response = await getSession(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.session.id).toBe('session-1');
    expect(body.data.questions).toEqual([{ id: 'q1', type: 'rating', prompt: 'Would you invest?' }]);
  });

  it('returns session questions from config.questions fallback', async () => {
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        config: {
          questions: [{ id: 'q-fallback', type: 'text', prompt: 'Fallback prompt?' }],
        },
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
      },
      error: null,
    });

    const request = new NextRequest(new Request('http://localhost/api/public/validate/event-1/session/session-1'));
    const response = await getSession(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.questions).toEqual([{ id: 'q-fallback', type: 'text', prompt: 'Fallback prompt?' }]);
  });

  it('returns 403 for expired session when loading session details', async () => {
    mockDb.getAudienceSessionById.mockResolvedValueOnce({
      data: {
        id: 'session-1',
        event_id: 'event-1',
        session_token: 'token-1',
        ip_address: '127.0.0.1',
        email: 'guest@example.com',
        consent_given: true,
        created_at: '2026-04-01T10:00:00.000Z',
        expires_at: '2000-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const request = new NextRequest(new Request('http://localhost/api/public/validate/event-1/session/session-1'));
    const response = await getSession(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(403);
  });

  it('submits responses successfully', async () => {
    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5 } }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 409 with exact duplicate message for duplicate founder submission', async () => {
    mockDb.getAudienceResponseBySessionAndFounderPitch.mockResolvedValueOnce({
      data: { id: 'resp-existing', audience_session_id: 'session-1', founder_pitch_id: 'pitch-1' },
      error: null,
    });

    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5 } }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("You've already submitted feedback for this founder");
  });

  it('returns 403 when the session is expired', async () => {
    mockDb.getAudienceSessionById.mockResolvedValueOnce({
      data: {
        id: 'session-1',
        event_id: 'event-1',
        session_token: 'token-1',
        ip_address: '127.0.0.1',
        email: 'guest@example.com',
        consent_given: true,
        created_at: '2026-04-01T10:00:00.000Z',
        expires_at: '2000-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5 } }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 400 when response payload is malformed', async () => {
    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: [] }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 when responses object is empty', async () => {
    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: {} }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 when founder pitch is outside the target event', async () => {
    mockDb.getFounderPitchById.mockResolvedValueOnce({
      data: { id: 'pitch-1', event_id: 'other-event' },
      error: null,
    });

    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 4 } }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 409 when same IP already submitted for founder in another session', async () => {
    mockDb.listAudienceSessionsByEventAndIp.mockResolvedValueOnce({
      data: [{ id: 'session-2' }],
      error: null,
    });
    mockDb.listAudienceResponsesByFounderPitchAndSessionIds.mockResolvedValueOnce({
      data: [{ id: 'resp-2' }],
      error: null,
    });

    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5 } }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("You've already submitted feedback for this founder");
  });

  it('returns 409 when same email already submitted for founder in another session', async () => {
    mockDb.listAudienceSessionsByEventAndIp.mockResolvedValueOnce({ data: [], error: null });
    mockDb.listAudienceSessionsByEventAndEmail.mockResolvedValueOnce({
      data: [{ id: 'session-2' }],
      error: null,
    });
    mockDb.listAudienceResponsesByFounderPitchAndSessionIds.mockResolvedValueOnce({
      data: [{ id: 'resp-2' }],
      error: null,
    });

    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5 } }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("You've already submitted feedback for this founder");
  });

  it('maps unique constraint insert errors to 409 duplicate message', async () => {
    mockDb.insertAudienceResponse.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    });

    const request = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 5 } }),
      })
    );

    const response = await submitResponse(request, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("You've already submitted feedback for this founder");
  });
});
