/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as listJudgeEvents } from '../src/app/api/judge/events/route';
import { GET as listEventPitches } from '../src/app/api/judge/events/[eventId]/pitches/route';
import { GET as getPitchDetail } from '../src/app/api/judge/pitches/[pitchId]/route';
import { GET as getPitchScore, POST as savePitchScore } from '../src/app/api/judge/pitches/[pitchId]/score/route';
import { requireJudge } from '../src/lib/auth/judge';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/judge', () => ({
  requireJudge: jest.fn(),
  canAccessEvent: jest.fn((roleAssignments, eventId: string) =>
    roleAssignments.some(
      (assignment: { role: string; scope: string; scoped_id: string | null }) =>
        assignment.role === 'judge' &&
        (assignment.scope === 'global' || (assignment.scope === 'event' && assignment.scoped_id === eventId))
    )
  ),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireJudge = requireJudge as jest.MockedFunction<typeof requireJudge>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json', authorization: 'Bearer judge-token' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('judge scoring API routes', () => {
  let mockDb: Record<string, jest.Mock>;

  const judgeContext = {
    userId: 'judge-1',
    auth: {
      sub: 'judge-1',
      email: 'judge@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    },
    roleAssignments: [
      {
        id: 'ra-1',
        user_id: 'judge-1',
        role: 'judge',
        scope: 'event',
        scoped_id: 'event-1',
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:00:00.000Z',
        created_by: null,
      },
    ],
  };

  beforeEach(() => {
    mockedRequireJudge.mockReset();
    mockedGetSupabaseClient.mockReset();
    mockedRequireJudge.mockResolvedValue(judgeContext);

    const pitch = {
      id: 'pitch-1',
      founder_id: 'founder-1',
      event_id: 'event-1',
      pitch_order: 1,
      pitch_deck_url: 'https://example.com/deck.pdf',
      score_aggregate: null,
      score_breakdown: null,
      validation_summary: null,
      is_published: false,
      published_at: null,
      created_at: '2026-03-26T00:00:00.000Z',
      updated_at: '2026-03-26T00:00:00.000Z',
      founder: {
        id: 'founder-1',
        company_name: 'Acme Ventures',
        tagline: 'Fast startup due diligence',
        bio: 'Aurrin founder',
        website: 'https://example.com',
        pitch_deck_url: 'https://example.com/deck.pdf',
        user: {
          id: 'user-founder-1',
          email: 'founder@example.com',
          name: 'Founder One',
        },
      },
    };

    const rubricVersion = {
      id: 'rubric-v1',
      rubric_template_id: 'template-1',
      event_id: 'event-1',
      version: 1,
      created_at: '2026-03-26T00:00:00.000Z',
      definition: {
        categories: [
          {
            name: 'Execution',
            weight: 100,
            questions: [
              { id: 'q1', text: 'Execution score', response_type: 'numeric', required: true },
            ],
          },
        ],
      },
    };

    mockDb = {
      listEvents: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'event-1',
            name: 'Demo Day',
            description: null,
            status: 'live',
            start_date: '2026-03-26T10:00:00.000Z',
            end_date: '2026-03-26T12:00:00.000Z',
            scoring_start: '2020-01-01T00:00:00.000Z',
            scoring_end: '2099-01-01T00:00:00.000Z',
            publishing_start: null,
            publishing_end: null,
            archived_at: null,
            starts_at: '2026-03-26T10:00:00.000Z',
            ends_at: '2026-03-26T12:00:00.000Z',
            config: {},
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
          },
        ],
        error: null,
      }),
      listEventsByIds: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'event-1',
            name: 'Demo Day',
            description: null,
            status: 'live',
            start_date: '2026-03-26T10:00:00.000Z',
            end_date: '2026-03-26T12:00:00.000Z',
            scoring_start: '2020-01-01T00:00:00.000Z',
            scoring_end: '2099-01-01T00:00:00.000Z',
            publishing_start: null,
            publishing_end: null,
            archived_at: null,
            starts_at: '2026-03-26T10:00:00.000Z',
            ends_at: '2026-03-26T12:00:00.000Z',
            config: {},
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
          },
        ],
        error: null,
      }),
      getEventById: jest.fn().mockResolvedValue({
        data: {
          id: 'event-1',
          name: 'Demo Day',
          description: null,
          status: 'live',
          start_date: '2026-03-26T10:00:00.000Z',
          end_date: '2026-03-26T12:00:00.000Z',
          scoring_start: '2020-01-01T00:00:00.000Z',
          scoring_end: '2099-01-01T00:00:00.000Z',
          publishing_start: null,
          publishing_end: null,
          archived_at: null,
          starts_at: '2026-03-26T10:00:00.000Z',
          ends_at: '2026-03-26T12:00:00.000Z',
          config: {},
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
        error: null,
      }),
      listFounderPitchesByEventId: jest.fn().mockResolvedValue({
        data: [pitch],
        error: null,
      }),
      getFounderPitchById: jest.fn().mockResolvedValue({
        data: pitch,
        error: null,
      }),
      getLatestRubricVersionByEventId: jest.fn().mockResolvedValue({
        data: rubricVersion,
        error: null,
      }),
      getJudgeScoreByJudgeAndPitch: jest.fn().mockResolvedValue({ data: null, error: null }),
      insertJudgeScore: jest.fn().mockResolvedValue({
        data: {
          id: 'score-1',
          judge_id: 'judge-1',
          founder_pitch_id: 'pitch-1',
          rubric_version_id: 'rubric-v1',
          responses: { q1: 88 },
          comments: 'Strong delivery',
          total_score: 88,
          category_scores: { Execution: 88 },
          state: 'draft',
          submitted_at: null,
          locked_at: null,
          created_at: '2026-03-26T00:00:00.000Z',
          updated_at: '2026-03-26T00:00:00.000Z',
        },
        error: null,
      }),
      updateJudgeScore: jest.fn().mockResolvedValue({
        data: {
          id: 'score-1',
          judge_id: 'judge-1',
          founder_pitch_id: 'pitch-1',
          rubric_version_id: 'rubric-v1',
          responses: { q1: 88 },
          comments: 'Strong delivery',
          total_score: 88,
          category_scores: { Execution: 88 },
          state: 'submitted',
          submitted_at: '2026-03-26T00:10:00.000Z',
          locked_at: null,
          created_at: '2026-03-26T00:00:00.000Z',
          updated_at: '2026-03-26T00:10:00.000Z',
        },
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

  it('lists judge-assigned events', async () => {
    const response = await listJudgeEvents(buildRequest('http://localhost/api/judge/events', 'GET'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true, data: expect.arrayContaining([expect.objectContaining({ id: 'event-1' })]) })
    );
    expect(mockDb.listEventsByIds).toHaveBeenCalledWith(['event-1']);
  });

  it('returns pitches for an authorized event and includes founder details', async () => {
    const response = await listEventPitches(
      buildRequest('http://localhost/api/judge/events/event-1/pitches', 'GET'),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        id: 'pitch-1',
        founder_email: 'founder@example.com',
      })
    );
  });

  it('returns pitch details with rubric for scoring', async () => {
    const response = await getPitchDetail(
      buildRequest('http://localhost/api/judge/pitches/pitch-1', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.pitch.id).toBe('pitch-1');
    expect(payload.data.rubric.id).toBe('rubric-v1');
  });

  it('saves a draft score and returns the required response contract', async () => {
    const response = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 88 },
        comments: 'Strong delivery',
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toEqual({
      score_id: 'score-1',
      total_score: 88,
      breakdown: { Execution: 88 },
      state: 'draft',
    });
  });

  it('transitions an existing score from draft to submitted', async () => {
    mockDb.getJudgeScoreByJudgeAndPitch.mockResolvedValueOnce({
      data: {
        id: 'score-1',
        judge_id: 'judge-1',
        founder_pitch_id: 'pitch-1',
        rubric_version_id: 'rubric-v1',
        responses: { q1: 80 },
        comments: 'Initial draft',
        total_score: 80,
        category_scores: { Execution: 80 },
        state: 'draft',
        submitted_at: null,
        locked_at: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:02:00.000Z',
      },
      error: null,
    });
    mockDb.updateJudgeScore.mockResolvedValueOnce({
      data: {
        id: 'score-1',
        judge_id: 'judge-1',
        founder_pitch_id: 'pitch-1',
        rubric_version_id: 'rubric-v1',
        responses: { q1: 91 },
        comments: 'Final submission',
        total_score: 91,
        category_scores: { Execution: 91 },
        state: 'submitted',
        submitted_at: '2026-03-26T00:10:00.000Z',
        locked_at: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:10:00.000Z',
      },
      error: null,
    });

    const response = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 91 },
        comments: 'Final submission',
        state: 'submitted',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        score_id: 'score-1',
        total_score: 91,
        breakdown: { Execution: 91 },
        state: 'submitted',
      },
    });
    expect(mockDb.insertJudgeScore).not.toHaveBeenCalled();
    expect(mockDb.updateJudgeScore).toHaveBeenCalledWith(
      'score-1',
      expect.objectContaining({
        state: 'submitted',
        total_score: 91,
      })
    );
  });

  it('validates required fields in score POST body', async () => {
    const response = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 88 },
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'comments must be a string.',
    });
  });

  it('returns conflict when optimistic concurrency updated_at mismatches', async () => {
    mockDb.getJudgeScoreByJudgeAndPitch.mockResolvedValueOnce({
      data: {
        id: 'score-1',
        judge_id: 'judge-1',
        founder_pitch_id: 'pitch-1',
        rubric_version_id: 'rubric-v1',
        responses: { q1: 88 },
        comments: 'Strong delivery',
        total_score: 88,
        category_scores: { Execution: 88 },
        state: 'draft',
        submitted_at: null,
        locked_at: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:05:00.000Z',
      },
      error: null,
    });

    const response = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 90 },
        comments: 'Updated comment',
        state: 'draft',
        updated_at: '2026-03-26T00:00:00.000Z',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'This score was updated elsewhere',
    });
  });

  it('returns 400 when score mutation happens outside scoring window', async () => {
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Demo Day',
        description: null,
        status: 'live',
        start_date: '2026-03-26T10:00:00.000Z',
        end_date: '2026-03-26T12:00:00.000Z',
        scoring_start: '2000-01-01T00:00:00.000Z',
        scoring_end: '2000-01-02T00:00:00.000Z',
        publishing_start: null,
        publishing_end: null,
        archived_at: null,
        starts_at: '2026-03-26T10:00:00.000Z',
        ends_at: '2026-03-26T12:00:00.000Z',
        config: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-03-25T00:00:00.000Z',
      },
      error: null,
    });

    const response = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 90 },
        comments: 'Outside scoring window',
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(400);
  });

  it('treats repeated submitted payload as idempotent and does not insert duplicates', async () => {
    mockDb.getJudgeScoreByJudgeAndPitch.mockResolvedValueOnce({
      data: {
        id: 'score-1',
        judge_id: 'judge-1',
        founder_pitch_id: 'pitch-1',
        rubric_version_id: 'rubric-v1',
        responses: { q1: 88 },
        comments: 'Strong delivery',
        total_score: 88,
        category_scores: { Execution: 88 },
        state: 'submitted',
        submitted_at: '2026-03-26T00:10:00.000Z',
        locked_at: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:10:00.000Z',
      },
      error: null,
    });

    const response = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 88 },
        comments: 'Strong delivery',
        state: 'submitted',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        score_id: 'score-1',
        total_score: 88,
        breakdown: { Execution: 88 },
        state: 'submitted',
      },
    });
    expect(mockDb.insertJudgeScore).not.toHaveBeenCalled();
    expect(mockDb.updateJudgeScore).not.toHaveBeenCalled();
  });

  it('enforces judge auth guard', async () => {
    mockedRequireJudge.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await getPitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(response.status).toBe(401);
  });
});
