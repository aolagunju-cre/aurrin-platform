/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getPitchDetail } from '../src/app/api/judge/pitches/[pitchId]/route';
import { GET as getPitchScore, POST as savePitchScore } from '../src/app/api/judge/pitches/[pitchId]/score/route';
import { requireJudge } from '../src/lib/auth/judge';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/judge', () => ({
  requireJudge: jest.fn(),
  canAccessEvent: jest.fn(
    (
      roleAssignments: Array<{ role: string; scope: string; scoped_id: string | null }>,
      eventId: string
    ) =>
      roleAssignments.some(
        (assignment) =>
          assignment.role === 'judge' &&
          (assignment.scope === 'global' ||
            (assignment.scope === 'event' && assignment.scoped_id === eventId))
      )
  ),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireJudge = requireJudge as jest.MockedFunction<typeof requireJudge>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

interface StoredScore {
  id: string;
  judge_id: string;
  founder_pitch_id: string;
  rubric_version_id: string;
  responses: Record<string, unknown>;
  comments: string | null;
  total_score: number | null;
  category_scores: Record<string, unknown>;
  state: 'draft' | 'submitted' | 'locked';
  submitted_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json', authorization: 'Bearer judge-token' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('judge scoring contract', () => {
  let insertCalls = 0;
  let scoreCounter = 1;
  let tick = 1;
  let currentJudgeId = 'judge-1';
  let roleAssignments: Array<{ role: string; scope: string; scoped_id: string | null }> = [];
  let storedScores: StoredScore[] = [];

  beforeEach(() => {
    insertCalls = 0;
    scoreCounter = 1;
    tick = 1;
    currentJudgeId = 'judge-1';
    roleAssignments = [
      {
        role: 'judge',
        scope: 'event',
        scoped_id: 'event-1',
      },
    ];

    storedScores = [];
    mockedRequireJudge.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockedRequireJudge.mockImplementation(async () => ({
      userId: currentJudgeId,
      auth: {
        sub: currentJudgeId,
        email: `${currentJudgeId}@example.com`,
        iat: 0,
        exp: 9999999999,
        aud: 'authenticated',
        iss: 'https://example.supabase.co/auth/v1',
      },
      roleAssignments: roleAssignments.map((assignment, idx) => ({
        id: `ra-${idx + 1}`,
        user_id: currentJudgeId,
        role: assignment.role,
        scope: assignment.scope,
        scoped_id: assignment.scoped_id,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:00:00.000Z',
        created_by: null,
      })),
    }));

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        getFounderPitchById: jest.fn(async (pitchId: string) => ({
          data: {
            id: pitchId,
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
          },
          error: null,
        })),
        getLatestRubricVersionByEventId: jest.fn(async () => ({
          data: {
            id: 'rubric-v1',
            rubric_template_id: 'template-1',
            event_id: 'event-1',
            version: 1,
            created_at: '2026-03-26T00:00:00.000Z',
            definition: {
              categories: [
                {
                  id: 'cat-product',
                  name: 'Product',
                  weight: 60,
                  questions: [{ id: 'q1', text: 'Product strength', response_type: 'numeric', required: true }],
                },
                {
                  id: 'cat-market',
                  name: 'Market',
                  weight: 40,
                  questions: [{ id: 'q2', text: 'Market size', response_type: 'numeric', required: true }],
                },
              ],
            },
          },
          error: null,
        })),
        getJudgeScoreByJudgeAndPitch: jest.fn(async (judgeId: string, founderPitchId: string) => ({
          data:
            storedScores.find(
              (score) =>
                score.judge_id === judgeId &&
                score.founder_pitch_id === founderPitchId
            ) ?? null,
          error: null,
        })),
        insertJudgeScore: jest.fn(async (record: Omit<StoredScore, 'id' | 'created_at' | 'updated_at'>) => {
          insertCalls += 1;
          const now = `2026-03-26T00:00:${String(tick).padStart(2, '0')}.000Z`;
          tick += 1;
          const next: StoredScore = {
            id: `score-${scoreCounter}`,
            created_at: now,
            updated_at: now,
            ...record,
          };
          scoreCounter += 1;
          storedScores.push(next);
          return { data: next, error: null };
        }),
        updateJudgeScore: jest.fn(
          async (id: string, updates: Partial<Omit<StoredScore, 'id' | 'created_at' | 'updated_at'>>) => {
            const index = storedScores.findIndex((score) => score.id === id);
            if (index === -1) {
              return { data: null, error: new Error('Score not found') };
            }
            const now = `2026-03-26T00:00:${String(tick).padStart(2, '0')}.000Z`;
            tick += 1;
            const updated: StoredScore = {
              ...storedScores[index],
              ...updates,
              updated_at: now,
            };
            storedScores[index] = updated;
            return { data: updated, error: null };
          }
        ),
      } as never,
    });
  });

  it('covers load rubric, draft save, submit, and persisted score state contract', async () => {
    const pitchResponse = await getPitchDetail(
      buildRequest('http://localhost/api/judge/pitches/pitch-1', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(pitchResponse.status).toBe(200);
    await expect(pitchResponse.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          rubric: expect.objectContaining({
            id: 'rubric-v1',
            definition: expect.objectContaining({
              categories: expect.arrayContaining([
                expect.objectContaining({ name: 'Product' }),
                expect.objectContaining({ name: 'Market' }),
              ]),
            }),
          }),
        }),
      })
    );

    const draftResponse = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 90, q2: 80 },
        comments: 'Strong product and TAM',
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(draftResponse.status).toBe(200);
    await expect(draftResponse.json()).resolves.toEqual({
      success: true,
      data: {
        score_id: 'score-1',
        total_score: 86,
        breakdown: { Product: 54, Market: 32 },
        state: 'draft',
      },
    });

    const currentScoreResponse = await getPitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(currentScoreResponse.status).toBe(200);
    const currentScorePayload = await currentScoreResponse.json();
    expect(currentScorePayload.data).toEqual(
      expect.objectContaining({
        score_id: 'score-1',
        state: 'draft',
        comments: 'Strong product and TAM',
        responses: { q1: 90, q2: 80 },
      })
    );

    const submitResponse = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 90, q2: 80 },
        comments: 'Strong product and TAM',
        state: 'submitted',
        updated_at: currentScorePayload.data.updated_at as string,
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(submitResponse.status).toBe(200);
    await expect(submitResponse.json()).resolves.toEqual({
      success: true,
      data: {
        score_id: 'score-1',
        total_score: 86,
        breakdown: { Product: 54, Market: 32 },
        state: 'submitted',
      },
    });

    const submittedScoreResponse = await getPitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    const submittedPayload = await submittedScoreResponse.json();
    expect(submittedPayload.data).toEqual(
      expect.objectContaining({
        score_id: 'score-1',
        state: 'submitted',
        submitted_at: expect.any(String),
        locked_at: null,
      })
    );
  });

  it('models 30-second draft autosave retries without creating duplicate score rows', async () => {
    const firstDraft = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 70, q2: 70 },
        comments: 'Autosave tick 1',
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(firstDraft.status).toBe(200);

    const firstRead = await getPitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    const firstReadPayload = await firstRead.json();

    const secondDraft = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 72, q2: 74 },
        comments: 'Autosave tick 2',
        state: 'draft',
        updated_at: firstReadPayload.data.updated_at,
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(secondDraft.status).toBe(200);

    const secondRead = await getPitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    const secondReadPayload = await secondRead.json();

    const thirdDraft = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 74, q2: 76 },
        comments: 'Autosave tick 3',
        state: 'draft',
        updated_at: secondReadPayload.data.updated_at,
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(thirdDraft.status).toBe(200);
    expect(storedScores).toHaveLength(1);
    expect(insertCalls).toBe(1);
    expect(storedScores[0].comments).toBe('Autosave tick 3');
  });

  it('keeps submit idempotent for repeated equivalent submit requests', async () => {
    await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 92, q2: 88 },
        comments: 'Final submission',
        state: 'submitted',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    const repeatSubmit = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 92, q2: 88 },
        comments: 'Final submission',
        state: 'submitted',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(repeatSubmit.status).toBe(200);
    await expect(repeatSubmit.json()).resolves.toEqual({
      success: true,
      data: {
        score_id: 'score-1',
        total_score: 90.4,
        breakdown: { Product: 55.2, Market: 35.2 },
        state: 'submitted',
      },
    });
    expect(storedScores).toHaveLength(1);
    expect(insertCalls).toBe(1);
  });

  it('returns conflict with exact message on stale updated_at writes', async () => {
    await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 80, q2: 80 },
        comments: 'Initial draft',
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    const conflictingSave = await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 81, q2: 82 },
        comments: 'Stale client draft',
        state: 'draft',
        updated_at: '2026-03-26T00:00:00.000Z',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(conflictingSave.status).toBe(409);
    await expect(conflictingSave.json()).resolves.toEqual({
      success: false,
      message: 'This score was updated elsewhere',
    });
  });

  it('enforces judge isolation by preventing cross-judge reads and mutations', async () => {
    currentJudgeId = 'judge-1';
    await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 85, q2: 75 },
        comments: 'Judge one draft',
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(storedScores).toHaveLength(1);
    expect(storedScores[0].judge_id).toBe('judge-1');

    currentJudgeId = 'judge-2';
    const judgeTwoScoreRead = await getPitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'GET'),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );
    expect(judgeTwoScoreRead.status).toBe(200);
    await expect(judgeTwoScoreRead.json()).resolves.toEqual({
      success: true,
      data: null,
    });

    await savePitchScore(
      buildRequest('http://localhost/api/judge/pitches/pitch-1/score', 'POST', {
        responses: { q1: 50, q2: 60 },
        comments: 'Judge two separate draft',
        state: 'draft',
      }),
      { params: Promise.resolve({ pitchId: 'pitch-1' }) }
    );

    expect(storedScores).toHaveLength(2);
    expect(storedScores.filter((score) => score.founder_pitch_id === 'pitch-1')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ judge_id: 'judge-1', comments: 'Judge one draft' }),
        expect.objectContaining({ judge_id: 'judge-2', comments: 'Judge two separate draft' }),
      ])
    );
  });
});
