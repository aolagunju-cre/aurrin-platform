/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { POST as submitFounderApplication } from '../src/app/api/public/apply/route';
import { PATCH as reviewFounderApplication } from '../src/app/api/protected/admin/founder-applications/[applicationId]/route';
import { POST as assignFoundersToEvent } from '../src/app/api/admin/events/[id]/assign-founders/route';
import { POST as submitJudgeScore } from '../src/app/api/judge/pitches/[pitchId]/score/route';
import { GET as getFounderScores } from '../src/app/api/founder/events/[eventId]/scores/route';
import { POST as createAudienceSession } from '../src/app/api/public/validate/[eventId]/session/route';
import { POST as submitAudienceResponse } from '../src/app/api/public/validate/[eventId]/session/[sessionId]/response/route';
import { GET as getValidationSummary } from '../src/app/api/public/events/[eventId]/pitches/[pitchId]/validation-summary/route';
import { POST as triggerMentorMatching } from '../src/app/api/admin/events/[eventId]/mentors/match/route';
import { PATCH as mentorRespondToMatch } from '../src/app/api/mentor/matches/[matchId]/route';
import { POST as receiveStripeWebhook } from '../src/app/api/commerce/webhooks/stripe/route';
import { GET as getContentById } from '../src/app/api/content/[id]/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { uploadFile } from '../src/lib/storage/upload';
import { sendEmail } from '../src/lib/email/send';
import { auditLog } from '../src/lib/audit/log';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { requireAdmin } from '../src/lib/auth/admin';
import { requireJudge } from '../src/lib/auth/judge';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { requireMentor } from '../src/lib/auth/mentor';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';
import { getStripeClient, getStripeEnv } from '../src/lib/payments/stripe-client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/storage/upload', () => ({
  uploadFile: jest.fn(),
  UploadError: class UploadError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock('../src/lib/email/send', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn(),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/auth/judge', () => ({
  requireJudge: jest.fn(),
  canAccessEvent: jest.fn(() => true),
}));

jest.mock('../src/lib/auth/founder', () => ({
  requireFounderOrAdmin: jest.fn(),
  canAccessFounderEvent: jest.fn(() => true),
}));

jest.mock('../src/lib/auth/mentor', () => ({
  requireMentor: jest.fn(),
  canAccessMentorEvent: jest.fn(() => true),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

jest.mock('../src/lib/payments/stripe-client', () => ({
  getStripeClient: jest.fn(),
  getStripeEnv: jest.fn(),
}));

type FounderApplicationState = {
  id: string;
  email: string;
  name: string;
  full_name: string;
  company_name: string;
  pitch_summary: string;
  industry: string;
  stage: string;
  deck_file_id: string;
  deck_path: string;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  status: 'pending' | 'accepted' | 'assigned' | 'declined';
  assigned_event_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  application_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type MentorMatchState = {
  id: string;
  mentor_id: string;
  founder_id: string;
  event_id: string;
  mentor_status: 'pending' | 'accepted' | 'declined';
  founder_status: 'pending' | 'accepted' | 'declined';
  mentor_accepted_at: string | null;
  founder_accepted_at: string | null;
  notes: string | null;
  declined_by: string | null;
  created_at: string;
  updated_at: string;
};

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockedAuditLog = auditLog as jest.MockedFunction<typeof auditLog>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedRequireJudge = requireJudge as jest.MockedFunction<typeof requireJudge>;
const mockedRequireFounderOrAdmin = requireFounderOrAdmin as jest.MockedFunction<typeof requireFounderOrAdmin>;
const mockedRequireMentor = requireMentor as jest.MockedFunction<typeof requireMentor>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
const mockedGetStripeClient = getStripeClient as jest.MockedFunction<typeof getStripeClient>;
const mockedGetStripeEnv = getStripeEnv as jest.MockedFunction<typeof getStripeEnv>;

function buildRequest(url: string, method: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

describe('critical journey e2e coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedRequireAdmin.mockResolvedValue({
      userId: 'admin-user-1',
      auth: { sub: 'admin-user-1' },
      roleAssignments: [{ role: 'admin', scope: 'global', scoped_id: null }],
    } as never);

    mockedRequireJudge.mockResolvedValue({
      userId: 'judge-user-1',
      auth: { sub: 'judge-user-1' },
      roleAssignments: [{ role: 'judge', scope: 'event', scoped_id: 'event-1' }],
    } as never);

    mockedRequireFounderOrAdmin.mockResolvedValue({
      userId: 'founder-user-1',
      isAdmin: false,
      founder: { id: 'founder-1', user_id: 'founder-user-1' },
      roleAssignments: [{ role: 'founder', scope: 'event', scoped_id: 'event-1' }],
    } as never);

    mockedRequireMentor.mockResolvedValue({
      userId: 'mentor-user-1',
      auth: { sub: 'mentor-user-1' },
      roleAssignments: [{ role: 'mentor', scope: 'event', scoped_id: 'event-1' }],
    } as never);

    mockedExtractTokenFromHeader.mockImplementation((header) => (header ? 'token' : null));
    mockedVerifyJWT.mockResolvedValue({
      sub: 'admin-user-1',
      email: 'admin@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });

    mockedGetStripeEnv.mockReturnValue({
      secretKey: 'sk_test_123',
      publishableKey: 'pk_test_123',
      webhookSecret: 'whsec_123',
    });
  });

  it('founder journey: apply to published scores visibility', async () => {
    const nowIso = new Date().toISOString();
    const applications = new Map<string, FounderApplicationState>();
    const users = new Map<string, { id: string; email: string; name: string }>();
    const founders = new Map<string, { id: string; user_id: string; company_name: string; website: string | null }>();

    const founderPitch = {
      id: 'pitch-1',
      founder_id: 'founder-1',
      event_id: 'event-1',
      score_aggregate: 0,
      score_breakdown: {} as Record<string, unknown>,
    };

    const judgeScores: Array<{
      id: string;
      judge_id: string;
      founder_pitch_id: string;
      total_score: number;
      category_scores: Record<string, unknown>;
      comments: string;
      state: 'draft' | 'submitted' | 'locked';
      submitted_at: string | null;
    }> = [];

    const db = {
      getFounderApplicationByEmail: jest.fn(async (email: string) => {
        const existing = Array.from(applications.values()).find((item) => item.email === email) ?? null;
        return { data: existing, error: null };
      }),
      insertFounderApplication: jest.fn(async (payload: Omit<FounderApplicationState, 'id' | 'created_at' | 'updated_at' | 'reviewed_at' | 'reviewed_by' | 'assigned_event_id'> & { assigned_event_id?: string | null }) => {
        const record: FounderApplicationState = {
          ...payload,
          id: 'app-1',
          assigned_event_id: payload.assigned_event_id ?? null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: nowIso,
          updated_at: nowIso,
        };
        applications.set(record.id, record);
        return { data: record, error: null };
      }),
      updateFounderApplication: jest.fn(async (id: string, patch: Partial<FounderApplicationState>) => {
        const current = applications.get(id);
        if (!current) {
          return { data: null, error: new Error('not found') };
        }
        const next = { ...current, ...patch, updated_at: nowIso };
        applications.set(id, next);
        return { data: next, error: null };
      }),
      getFounderApplicationById: jest.fn(async (id: string) => ({ data: applications.get(id) ?? null, error: null })),
      getRoleAssignmentsByUserId: jest.fn(async (userId: string) => {
        if (userId === 'admin-user-1') {
          return {
            data: [{ id: 'ra-admin', user_id: userId, role: 'admin', scope: 'global', scoped_id: null }],
            error: null,
          };
        }
        return {
          data: [{ id: 'ra-founder', user_id: userId, role: 'founder', scope: 'event', scoped_id: 'event-1' }],
          error: null,
        };
      }),
      getUserByEmail: jest.fn(async (email: string) => {
        const user = Array.from(users.values()).find((entry) => entry.email === email) ?? null;
        return { data: user, error: null };
      }),
      insertUser: jest.fn(async (payload: { email: string; name: string }) => {
        const user = { id: 'founder-user-1', email: payload.email, name: payload.name };
        users.set(user.id, user);
        return { data: user, error: null };
      }),
      getFounderByUserId: jest.fn(async (userId: string) => {
        const founder = Array.from(founders.values()).find((entry) => entry.user_id === userId) ?? null;
        return { data: founder, error: null };
      }),
      insertFounder: jest.fn(async (payload: { user_id: string; company_name: string; website?: string | null }) => {
        const founder = {
          id: 'founder-1',
          user_id: payload.user_id,
          company_name: payload.company_name,
          website: payload.website ?? null,
        };
        founders.set(founder.id, founder);
        return { data: founder, error: null };
      }),
      getEventById: jest.fn(async (id: string) => {
        if (id !== 'event-1') {
          return { data: null, error: null };
        }
        return {
          data: {
            id: 'event-1',
            name: 'Demo Day',
            scoring_start: '2020-01-01T00:00:00.000Z',
            scoring_end: '2099-01-01T00:00:00.000Z',
            publishing_start: '2000-01-01T00:00:00.000Z',
            publishing_end: '2099-01-02T00:00:00.000Z',
          },
          error: null,
        };
      }),
      queryTable: jest.fn(async (table: string, query: string) => {
        if (table === 'founder_applications' && query.includes('status=in.(accepted,assigned)')) {
          return {
            data: Array.from(applications.values()).filter((row) => row.status === 'accepted' || row.status === 'assigned'),
            error: null,
          };
        }
        if (table === 'founder_pitches') {
          return { data: [founderPitch], error: null };
        }
        if (table === 'judge_scores') {
          return {
            data: judgeScores
              .filter((score) => score.founder_pitch_id === founderPitch.id && (score.state === 'submitted' || score.state === 'locked'))
              .map((score) => ({
                judge_id: score.judge_id,
                total_score: score.total_score,
                category_scores: score.category_scores,
                comments: score.comments,
                state: score.state,
                submitted_at: score.submitted_at,
              })),
            error: null,
          };
        }
        if (table === 'users') {
          return { data: [{ id: 'judge-user-1', name: 'Judge One', email: 'judge@example.com' }], error: null };
        }
        return { data: [], error: null };
      }),
      getFounderPitchById: jest.fn(async () => ({
        data: {
          id: founderPitch.id,
          founder_id: founderPitch.founder_id,
          event_id: founderPitch.event_id,
        },
        error: null,
      })),
      getLatestRubricVersionByEventId: jest.fn(async () => ({
        data: {
          id: 'rubric-v1',
          event_id: 'event-1',
          definition: {
            categories: [
              {
                name: 'Execution',
                weight: 100,
                questions: [{ id: 'q1', text: 'Execution', response_type: 'numeric', required: true }],
              },
            ],
          },
        },
        error: null,
      })),
      getJudgeScoreByJudgeAndPitch: jest.fn(async (judgeId: string, pitchId: string) => {
        const existing = judgeScores.find((score) => score.judge_id === judgeId && score.founder_pitch_id === pitchId) ?? null;
        return { data: existing, error: null };
      }),
      insertJudgeScore: jest.fn(async (payload: { judge_id: string; founder_pitch_id: string; total_score: number; category_scores: Record<string, unknown>; comments: string; state: 'draft' | 'submitted' | 'locked'; submitted_at: string | null; }) => {
        const record = {
          id: 'score-1',
          judge_id: payload.judge_id,
          founder_pitch_id: payload.founder_pitch_id,
          total_score: payload.total_score,
          category_scores: payload.category_scores,
          comments: payload.comments,
          state: payload.state,
          submitted_at: payload.submitted_at,
        };
        judgeScores.push(record);
        founderPitch.score_aggregate = payload.total_score;
        founderPitch.score_breakdown = payload.category_scores;
        return { data: record, error: null };
      }),
      updateJudgeScore: jest.fn(async () => ({ data: null, error: null })),
      listSubscriptionsByUserId: jest.fn(async () => ({ data: [], error: null })),
      listEntitlementsByUserId: jest.fn(async () => ({ data: [], error: null })),
      getContentById: jest.fn(async () => ({ data: null, error: null })),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: db as never,
    });

    mockedUploadFile.mockResolvedValue({
      id: 'file-1',
      file_id: 'file-1',
      path: 'pitch-decks/public/deck.pdf',
      content_type: 'application/pdf',
      size_bytes: 1024,
      source: 'supabase',
    });

    const formData = new FormData();
    formData.set('full_name', 'Jane Founder');
    formData.set('email', 'jane@example.com');
    formData.set('company_name', 'Acme Labs');
    formData.set('pitch_summary', 'A'.repeat(120));
    formData.set('industry', 'Fintech');
    formData.set('stage', 'Seed');
    formData.set('deck_file', new File(['%PDF'], 'deck.pdf', { type: 'application/pdf' }));

    const applyRequest = new NextRequest(
      new Request('http://localhost/api/public/apply', {
        method: 'POST',
        body: formData,
      })
    );

    const applyResponse = await submitFounderApplication(applyRequest);
    expect(applyResponse.status).toBe(200);
    expect(applications.get('app-1')?.status).toBe('pending');

    const approveRequest = buildRequest(
      'http://localhost/api/protected/admin/founder-applications/app-1',
      'PATCH',
      { status: 'accepted' },
      { authorization: 'Bearer admin-token' }
    );
    const approveResponse = await reviewFounderApplication(approveRequest, {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    expect(approveResponse.status).toBe(200);
    expect(applications.get('app-1')?.status).toBe('accepted');

    const assignRequest = buildRequest(
      'http://localhost/api/admin/events/event-1/assign-founders',
      'POST',
      { founder_application_ids: ['app-1'] }
    );
    const assignResponse = await assignFoundersToEvent(assignRequest, { params: Promise.resolve({ id: 'event-1' }) });
    expect(assignResponse.status).toBe(200);
    expect(applications.get('app-1')?.status).toBe('assigned');
    expect(applications.get('app-1')?.assigned_event_id).toBe('event-1');

    const scoreRequest = buildRequest(
      'http://localhost/api/judge/pitches/pitch-1/score',
      'POST',
      {
        responses: { q1: 91 },
        comments: 'Strong execution',
        state: 'submitted',
      }
    );
    const scoreResponse = await submitJudgeScore(scoreRequest, { params: Promise.resolve({ pitchId: 'pitch-1' }) });
    expect(scoreResponse.status).toBe(200);

    const founderScoresResponse = await getFounderScores(
      new NextRequest(new Request('http://localhost/api/founder/events/event-1/scores')),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(founderScoresResponse.status).toBe(200);
    await expect(founderScoresResponse.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          aggregate: expect.objectContaining({ total_score: 91 }),
          published: true,
        }),
      })
    );
  });

  it('audience validation journey: session to aggregate visibility', async () => {
    const sessions = new Map<string, {
      id: string;
      event_id: string;
      session_token: string;
      ip_address: string | null;
      email: string | null;
      consent_given: boolean;
      created_at: string;
      expires_at: string;
    }>();

    const responses = new Array<{ founder_pitch_id: string; audience_session_id: string; responses: Record<string, unknown> }>();

    const db = {
      getEventById: jest.fn(async () => ({
        data: {
          id: 'event-1',
          name: 'Demo Day',
          config: {
            validation_questions: [{ id: 'q1', type: 'rating', prompt: 'Would you invest?' }],
          },
          publishing_start: '2000-01-01T00:00:00.000Z',
          start_date: '2026-04-01T10:00:00.000Z',
          end_date: '2026-04-01T12:00:00.000Z',
        },
        error: null,
      })),
      insertAudienceSession: jest.fn(async (payload: { event_id: string; session_token: string; ip_address: string | null; email: string | null; consent_given: boolean; expires_at: string; }) => {
        const record = {
          id: 'session-1',
          event_id: payload.event_id,
          session_token: payload.session_token,
          ip_address: payload.ip_address,
          email: payload.email,
          consent_given: payload.consent_given,
          created_at: new Date().toISOString(),
          expires_at: payload.expires_at,
        };
        sessions.set(record.id, record);
        return { data: record, error: null };
      }),
      getAudienceSessionById: jest.fn(async (id: string) => ({ data: sessions.get(id) ?? null, error: null })),
      listFounderPitchesByEventId: jest.fn(async () => ({ data: [{ id: 'pitch-1', founder_id: 'founder-1', pitch_order: 1, founder: { company_name: 'Acme' } }], error: null })),
      getFounderPitchById: jest.fn(async () => ({ data: { id: 'pitch-1', event_id: 'event-1', founder_id: 'founder-1' }, error: null })),
      getAudienceResponseBySessionAndFounderPitch: jest.fn(async (sessionId: string, pitchId: string) => {
        const match = responses.find((entry) => entry.audience_session_id === sessionId && entry.founder_pitch_id === pitchId) ?? null;
        return { data: match, error: null };
      }),
      listAudienceSessionsByEventAndIp: jest.fn(async () => ({ data: [], error: null })),
      listAudienceSessionsByEventAndEmail: jest.fn(async () => ({ data: [], error: null })),
      listAudienceResponsesByFounderPitchAndSessionIds: jest.fn(async () => ({ data: [], error: null })),
      insertAudienceResponse: jest.fn(async (payload: { founder_pitch_id: string; audience_session_id: string; responses: Record<string, unknown> }) => {
        responses.push(payload);
        return { data: { id: 'resp-1', ...payload }, error: null };
      }),
      getRoleAssignmentsByUserId: jest.fn(async () => ({
        data: [{ id: 'ra-admin', role: 'admin', scope: 'global', scoped_id: null }],
        error: null,
      })),
      getFounderByUserId: jest.fn(async () => ({ data: { id: 'founder-1', user_id: 'admin-user-1' }, error: null })),
      queryTable: jest.fn(async (table: string) => {
        if (table === 'audience_responses') {
          return { data: responses.map((row) => ({ responses: row.responses })), error: null };
        }
        return { data: [], error: null };
      }),
      listSubscriptionsByUserId: jest.fn(async () => ({ data: [], error: null })),
      listEntitlementsByUserId: jest.fn(async () => ({ data: [], error: null })),
      getContentById: jest.fn(async () => ({ data: null, error: null })),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: db as never,
    });

    const createSessionRequest = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({ email: 'audience@example.com', consent_given: true }),
      })
    );

    const sessionResponse = await createAudienceSession(createSessionRequest, {
      params: Promise.resolve({ eventId: 'event-1' }),
    });
    expect(sessionResponse.status).toBe(201);

    const feedbackRequest = new NextRequest(
      new Request('http://localhost/api/public/validate/event-1/session/session-1/response', {
        method: 'POST',
        body: JSON.stringify({ founder_pitch_id: 'pitch-1', responses: { q1: 4 } }),
      })
    );

    const feedbackResponse = await submitAudienceResponse(feedbackRequest, {
      params: Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' }),
    });
    expect(feedbackResponse.status).toBe(200);

    const aggregateResponse = await getValidationSummary(
      new NextRequest(
        new Request('http://localhost/api/public/events/event-1/pitches/pitch-1/validation-summary', {
          headers: { authorization: 'Bearer admin-token' },
        })
      ),
      { params: Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-1' }) }
    );

    expect(aggregateResponse.status).toBe(200);
    await expect(aggregateResponse.json()).resolves.toEqual(
      expect.objectContaining({
        total_responses: 1,
        aggregate_score: 4,
      })
    );
  });

  it('mentor matching journey: admin trigger to mutual-acceptance email trigger', async () => {
    const matches = new Map<string, MentorMatchState>();

    const db = {
      getEventById: jest.fn(async () => ({ data: { id: 'event-1', name: 'Mentor Night' }, error: null })),
      listMentorIdsByEventId: jest.fn(async () => ({ data: ['mentor-user-1'], error: null })),
      listFounderIdsByEventId: jest.fn(async () => ({ data: ['founder-1'], error: null })),
      listRecentMentorPairs: jest.fn(async () => ({ data: [], error: null })),
      insertMentorMatch: jest.fn(async () => {
        const record: MentorMatchState = {
          id: 'match-1',
          mentor_id: 'mentor-user-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'pending',
          founder_status: 'accepted',
          mentor_accepted_at: null,
          founder_accepted_at: new Date().toISOString(),
          notes: null,
          declined_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        matches.set(record.id, record);
        return { data: record, error: null };
      }),
      getMentorMatchById: jest.fn(async (id: string) => ({ data: matches.get(id) ?? null, error: null })),
      updateMentorMatchById: jest.fn(async (id: string, patch: Partial<MentorMatchState>) => {
        const current = matches.get(id);
        if (!current) {
          return { data: null, error: new Error('not found') };
        }
        const next = { ...current, ...patch, updated_at: new Date().toISOString() };
        matches.set(id, next);
        return { data: next, error: null };
      }),
      getUserById: jest.fn(async () => ({ data: { id: 'founder-user-1', email: 'founder@example.com', name: 'Founder One' }, error: null })),
      insertOutboxJob: jest.fn(async (payload: { job_type: string; aggregate_id?: string | null; aggregate_type?: string | null; payload: Record<string, unknown> }) => ({
        data: {
          id: 'job-match-1',
          job_type: payload.job_type,
          aggregate_id: payload.aggregate_id ?? null,
          aggregate_type: payload.aggregate_type ?? null,
          payload: payload.payload,
          state: 'pending',
          retry_count: 0,
          max_retries: 3,
          last_error: null,
          email_id: null,
          error_message: null,
          scheduled_at: null,
          started_at: null,
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      })),
      listSubscriptionsByUserId: jest.fn(async () => ({ data: [], error: null })),
      listEntitlementsByUserId: jest.fn(async () => ({ data: [], error: null })),
      getContentById: jest.fn(async () => ({ data: null, error: null })),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: db as never,
    });

    const createMatchesResponse = await triggerMentorMatching(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 1,
        exclude_previous_pairs_months: 0,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(createMatchesResponse.status).toBe(200);
    await expect(createMatchesResponse.json()).resolves.toEqual({ matches_created: 1, conflicts: 0 });

    const mentorAcceptResponse = await mentorRespondToMatch(
      buildRequest('http://localhost/api/mentor/matches/match-1', 'PATCH', { action: 'accept' }),
      { params: Promise.resolve({ matchId: 'match-1' }) }
    );

    expect(mentorAcceptResponse.status).toBe(200);
    await expect(mentorAcceptResponse.json()).resolves.toEqual({
      success: true,
      data: { status: 'accepted', mutual_acceptance: true },
    });

    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'mentor_match',
      expect.objectContaining({
        match_id: 'match-1',
        reason: 'mutual_acceptance',
      }),
      expect.objectContaining({
        aggregate_id: 'match-1',
        aggregate_type: 'mentor_match',
      }),
    );
  });

  it('subscription journey: webhook grants entitlement and premium content becomes accessible', async () => {
    const entitlements: Array<{ user_id: string; product_id: string; source: 'purchase' | 'subscription'; expires_at: string | null }> = [];
    const subscriptions: Array<{ user_id: string; status: string; current_period_end: string | null }> = [];

    const db = {
      getTransactionByStripeEventId: jest.fn(async () => ({ data: null, error: null })),
      getSubscriptionByStripeId: jest.fn(async () => ({ data: null, error: null })),
      upsertSubscription: jest.fn(async (payload: { user_id: string; status: string; current_period_end: string | null; }) => {
        subscriptions.push({
          user_id: payload.user_id,
          status: payload.status,
          current_period_end: payload.current_period_end,
        });
        return { data: { id: 'sub-internal-1', ...payload }, error: null };
      }),
      insertTransaction: jest.fn(async () => ({ data: { id: 'tx-1' }, error: null })),
      insertEntitlement: jest.fn(async (payload: { user_id: string; product_id: string; source: 'purchase' | 'subscription'; expires_at?: string | null }) => {
        const record = {
          user_id: payload.user_id,
          product_id: payload.product_id,
          source: payload.source,
          expires_at: payload.expires_at ?? null,
        };
        entitlements.push(record);
        return { data: { id: 'ent-1', ...record }, error: null };
      }),
      getUserById: jest.fn(async () => ({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'subscriber@example.com',
          name: 'Subscriber',
        },
        error: null,
      })),
      listSubscriptionsByUserId: jest.fn(async (userId: string) => ({
        data: subscriptions.filter((entry) => entry.user_id === userId),
        error: null,
      })),
      listEntitlementsByUserId: jest.fn(async (userId: string) => ({
        data: entitlements.filter((entry) => entry.user_id === userId),
        error: null,
      })),
      getContentById: jest.fn(async (id: string) => ({
        data: {
          id,
          title: 'Premium deck',
          product_id: '22222222-2222-4222-8222-222222222222',
          requires_subscription: true,
        },
        error: null,
      })),
      getFounderApplicationByEmail: jest.fn(async () => ({ data: null, error: null })),
      getEventById: jest.fn(async () => ({ data: null, error: null })),
      queryTable: jest.fn(async () => ({ data: [], error: null })),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: db as never,
    });

    const stripeEvent = {
      id: 'evt_sub_created_1',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_stripe_1',
          status: 'active',
          customer: 'cus_123',
          metadata: {
            user_id: '11111111-1111-4111-8111-111111111111',
            product_id: '22222222-2222-4222-8222-222222222222',
            price_id: '33333333-3333-4333-8333-333333333333',
          },
          items: {
            data: [
              {
                price: {
                  metadata: {
                    product_id: '22222222-2222-4222-8222-222222222222',
                    price_id: '33333333-3333-4333-8333-333333333333',
                  },
                },
              },
            ],
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          cancel_at: null,
        },
      },
    };

    const constructEvent = jest.fn().mockReturnValue(stripeEvent);
    mockedGetStripeClient.mockReturnValue({ webhooks: { constructEvent } } as never);

    const webhookResponse = await receiveStripeWebhook(
      new NextRequest('http://localhost/api/commerce/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig_123' },
        body: JSON.stringify({ id: 'evt_sub_created_1' }),
      })
    );

    expect(webhookResponse.status).toBe(200);
    await expect(webhookResponse.json()).resolves.toEqual({ received: true, duplicate: false, deadLettered: false });

    mockedVerifyJWT.mockResolvedValueOnce({
      sub: '11111111-1111-4111-8111-111111111111',
      email: 'subscriber@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });

    const contentResponse = await getContentById(
      new NextRequest('http://localhost/api/content/content-1', {
        headers: { authorization: 'Bearer subscriber-token' },
      }),
      { params: Promise.resolve({ id: 'content-1' }) }
    );

    expect(contentResponse.status).toBe(200);
    await expect(contentResponse.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'content-1' }),
      })
    );
  });

});
