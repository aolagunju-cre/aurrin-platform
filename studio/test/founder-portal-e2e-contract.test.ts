/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getFounderScores } from '../src/app/api/founder/events/[eventId]/scores/route';
import { GET as getFounderValidation } from '../src/app/api/founder/events/[eventId]/validation/route';
import { POST as generateReport } from '../src/app/api/founder/reports/generate/route';
import { GET as getReportStatus } from '../src/app/api/founder/reports/[reportId]/status/route';
import { GET as downloadReport } from '../src/app/api/founder/reports/[reportId]/download/route';
import { POST as generateMentorMatches } from '../src/app/api/admin/events/[eventId]/mentors/match/route';
import { PATCH as patchMentorMatch } from '../src/app/api/mentor/matches/[matchId]/route';
import { GET as listFounderMentorMatches } from '../src/app/api/founder/matches/route';
import { requireAdmin } from '../src/lib/auth/admin';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { requireMentor } from '../src/lib/auth/mentor';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { getSupabaseClient } from '../src/lib/db/client';
import { handlePdfJob } from '../src/lib/jobs/handlers/pdf';
import { handleMentorMatchJob } from '../src/lib/jobs/handlers/mentor-match';
import { renderEmailTemplate } from '../src/lib/email/templates';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/auth/founder', () => ({
  requireFounderOrAdmin: jest.fn(),
  canAccessFounderEvent: jest.fn(() => true),
}));

jest.mock('../src/lib/auth/mentor', () => ({
  requireMentor: jest.fn(),
  canAccessMentorEvent: jest.fn(() => true),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireFounderOrAdmin = requireFounderOrAdmin as jest.MockedFunction<typeof requireFounderOrAdmin>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedRequireMentor = requireMentor as jest.MockedFunction<typeof requireMentor>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
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

describe('founder portal end-to-end contract', () => {
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
      social_proof: null,
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
  const adminContext = {
    userId: 'admin-1',
    auth: {
      sub: 'admin-1',
      email: 'admin@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    },
    roleAssignments: [],
    isAdmin: true,
  };
  const mentorContext = {
    userId: 'mentor-2',
    auth: {
      sub: 'mentor-2',
      email: 'mentor2@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    },
    roleAssignments: [
      {
        id: 'ra-mentor-2',
        user_id: 'mentor-2',
        role: 'mentor',
        scope: 'event',
        scoped_id: 'event-1',
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
        created_by: null,
      },
    ],
    isAdmin: false,
    isMentor: true,
  };

  let mockDb: Record<string, jest.Mock>;
  let mockStorage: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedRequireAdmin.mockReset();
    mockedRequireFounderOrAdmin.mockReset();
    mockedRequireMentor.mockReset();
    mockedEnqueueJob.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockDb = {
      getEventById: jest.fn(),
      queryTable: jest.fn(),
      insertFile: jest.fn(),
      listMentorIdsByEventId: jest.fn(),
      listFounderIdsByEventId: jest.fn(),
      listRecentMentorPairs: jest.fn(),
      insertMentorMatch: jest.fn(),
      getMentorMatchById: jest.fn(),
      updateMentorMatchById: jest.fn(),
      getUserById: jest.fn(),
    };

    mockStorage = {
      upload: jest.fn().mockResolvedValue({ path: 'founder-1/report-job-1.pdf', error: null }),
      remove: jest.fn().mockResolvedValue({ error: null }),
      createSignedUrl: jest.fn(),
    };

    mockedGetSupabaseClient.mockReturnValue({
      db: mockDb as never,
      storage: mockStorage as never,
    });
  });

  it('returns 401 for unauthenticated founder API requests', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await getFounderScores(
      buildRequest('http://localhost/api/founder/events/event-1/scores', 'GET'),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(401);
  });

  it('enforces pre-publish gating and allows post-publish score and validation visibility', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValue(founderContext);

    mockDb.getEventById
      .mockResolvedValueOnce({
        data: { id: 'event-1', name: 'Demo Day', publishing_start: '2999-01-01T00:00:00.000Z' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'event-1', name: 'Demo Day', publishing_start: '2000-01-01T00:00:00.000Z' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'event-1', name: 'Demo Day', publishing_start: '2000-01-01T00:00:00.000Z' },
        error: null,
      });

    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', founder_id: 'founder-1', score_aggregate: 91, score_breakdown: { Team: 92 } }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', founder_id: 'founder-1', score_aggregate: 91, score_breakdown: { Team: 92 } }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            judge_id: 'judge-1',
            total_score: 91,
            category_scores: { Team: 92 },
            comments: 'Strong delivery',
            state: 'submitted',
            submitted_at: '2026-03-27T00:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'judge-1', name: 'Judge One', email: 'judge1@example.com' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', founder_id: 'founder-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { responses: { invest: 'yes', confidence: 4, notes: 'Great team and clear traction.' } },
          { responses: { invest: 'maybe', confidence: 3, notes: 'Promising but early.' } },
        ],
        error: null,
      });

    const prePublishResponse = await getFounderScores(
      buildRequest('http://localhost/api/founder/events/event-1/scores', 'GET'),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(prePublishResponse.status).toBe(403);

    const postPublishScoresResponse = await getFounderScores(
      buildRequest('http://localhost/api/founder/events/event-1/scores', 'GET'),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(postPublishScoresResponse.status).toBe(200);

    const scoresPayload = await postPublishScoresResponse.json();
    expect(scoresPayload.data.aggregate.total_score).toBe(91);
    expect(scoresPayload.data.per_judge).toEqual(
      expect.arrayContaining([expect.objectContaining({ judge_id: 'judge-1', judge_name: 'Judge One' })])
    );

    const postPublishValidationResponse = await getFounderValidation(
      buildRequest('http://localhost/api/founder/events/event-1/validation', 'GET'),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(postPublishValidationResponse.status).toBe(200);

    const validationPayload = await postPublishValidationResponse.json();
    expect(validationPayload.data.summary.total_responses).toBe(2);
    expect(validationPayload.data.summary.by_question).toEqual(
      expect.arrayContaining([expect.objectContaining({ question_id: 'invest' })])
    );
  });

  it('covers report generation lifecycle including failed status and download', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValue(founderContext);

    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [{ id: 'pitch-1', founder_id: 'founder-1', event_id: 'event-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'job-1',
            payload: {
              founder_id: 'founder-1',
              event_id: 'event-1',
              pitch_id: 'pitch-1',
              report_type: 'full',
            },
            state: 'failed',
            created_at: '2026-03-27T00:00:00.000Z',
            completed_at: null,
            error_message: 'PDF generation failed',
            last_error: 'PDF generation failed',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'job-2',
            payload: {
              founder_id: 'founder-1',
              event_id: 'event-1',
              pitch_id: 'pitch-1',
              report_type: 'summary',
            },
            state: 'completed',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'file-1',
            owner_id: 'founder-1',
            storage_path: 'generated-reports/founder-1/report-job-2.pdf',
            signed_url_expiry: null,
          },
        ],
        error: null,
      });

    mockStorage.createSignedUrl.mockResolvedValueOnce({
      signedUrl: 'https://example.test/signed/report-job-2.pdf',
      error: null,
    });

    mockedEnqueueJob.mockResolvedValueOnce({
      id: 'job-1',
      job_type: 'generate_pdf_report',
      aggregate_id: 'pitch-1',
      aggregate_type: 'founder_pitch',
      payload: {},
      state: 'pending',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      email_id: null,
      error_message: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-03-27T00:00:00.000Z',
      updated_at: '2026-03-27T00:00:00.000Z',
    });

    const generateResponse = await generateReport(
      buildRequest('http://localhost/api/founder/reports/generate', 'POST', {
        event_id: 'event-1',
        pitch_id: 'pitch-1',
        report_type: 'full',
      })
    );

    expect(generateResponse.status).toBe(202);
    const generatePayload = await generateResponse.json();
    expect(generatePayload.message).toBe("Your report is being generated. You'll receive an email when ready.");

    const failedStatusResponse = await getReportStatus(
      buildRequest('http://localhost/api/founder/reports/job-1/status', 'GET'),
      { params: Promise.resolve({ reportId: 'job-1' }) }
    );
    expect(failedStatusResponse.status).toBe(200);

    const failedStatusPayload = await failedStatusResponse.json();
    expect(failedStatusPayload.data.status).toBe('failed');
    expect(failedStatusPayload.data.error).toBe('PDF generation failed');

    const downloadResponse = await downloadReport(
      buildRequest('http://localhost/api/founder/reports/job-2/download', 'GET'),
      { params: Promise.resolve({ reportId: 'job-2' }) }
    );
    expect(downloadResponse.status).toBe(200);

    const downloadPayload = await downloadResponse.json();
    expect(downloadPayload.data.url).toBe('https://example.test/signed/report-job-2.pdf');
    expect(downloadPayload.data.expires_in).toBe(7 * 24 * 60 * 60);
  });

  it('covers mentor-matching contract flow: random matching, accept transitions, and intro email trigger', async () => {
    const createdMatches: Array<Record<string, unknown>> = [];
    let founderAccepted = false;

    mockedRequireAdmin.mockResolvedValue(adminContext as never);
    mockedRequireMentor.mockResolvedValue(mentorContext as never);
    mockedRequireFounderOrAdmin.mockResolvedValue(founderContext as never);
    mockedEnqueueJob.mockResolvedValue({
      id: 'job-mentor-1',
      job_type: 'mentor_match',
      aggregate_id: 'match-1',
      aggregate_type: 'mentor_match',
      payload: {},
      state: 'pending',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      email_id: null,
      error_message: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-03-27T00:00:00.000Z',
      updated_at: '2026-03-27T00:00:00.000Z',
    } as never);

    mockDb.getEventById.mockResolvedValue({
      data: { id: 'event-1', name: 'Demo Day', publishing_start: '2000-01-01T00:00:00.000Z' },
      error: null,
    });
    mockDb.listMentorIdsByEventId
      .mockResolvedValueOnce({ data: ['mentor-1', 'mentor-2'], error: null })
      .mockResolvedValueOnce({ data: ['mentor-1'], error: null });
    mockDb.listFounderIdsByEventId.mockResolvedValue({ data: ['founder-1'], error: null });
    mockDb.listRecentMentorPairs.mockResolvedValue({
      data: [{ mentor_id: 'mentor-1', founder_id: 'founder-1', created_at: '2026-03-20T00:00:00.000Z' }],
      error: null,
    });
    mockDb.insertMentorMatch.mockImplementation(async (payload: Record<string, unknown>) => {
      const match = {
        id: `match-${createdMatches.length + 1}`,
        mentor_id: payload.mentor_id as string,
        founder_id: payload.founder_id as string,
        event_id: payload.event_id as string,
        mentor_status: payload.mentor_status ?? 'pending',
        founder_status: payload.founder_status ?? 'pending',
        mentor_accepted_at: null,
        founder_accepted_at: founderAccepted ? '2026-03-27T00:12:00.000Z' : null,
        declined_by: null,
        notes: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
      };
      createdMatches.push(match);
      return { data: match, error: null };
    });
    mockDb.getMentorMatchById.mockImplementation(async (matchId: string) => {
      const match = createdMatches.find((candidate) => candidate.id === matchId);
      if (!match) {
        return { data: null, error: null };
      }
      return {
        data: {
          ...match,
          founder_status: founderAccepted ? 'accepted' : match.founder_status,
          founder_accepted_at: founderAccepted ? '2026-03-27T00:12:00.000Z' : null,
        },
        error: null,
      };
    });
    mockDb.updateMentorMatchById.mockImplementation(async (matchId: string, updates: Record<string, unknown>) => {
      const match = createdMatches.find((candidate) => candidate.id === matchId);
      if (!match) {
        return { data: null, error: null };
      }
      Object.assign(match, updates, { updated_at: '2026-03-27T00:15:00.000Z' });
      return { data: match, error: null };
    });
    mockDb.getUserById.mockImplementation(async (userId: string) => {
      if (userId === 'mentor-2') {
        return { data: { id: 'mentor-2', email: 'mentor2@example.com', name: 'Mentor Two' }, error: null };
      }
      if (userId === 'founder-user-1') {
        return { data: { id: 'founder-user-1', email: 'founder@example.com', name: 'Founder One' }, error: null };
      }
      return { data: null, error: null };
    });
    mockDb.queryTable.mockImplementation(async (table: string) => {
      if (table === 'founders') {
        return { data: [{ id: 'founder-1', user_id: 'founder-user-1', company_name: 'Aurrin Labs', bio: 'Pitch summary' }], error: null };
      }
      if (table === 'mentor_matches') {
        return {
          data: createdMatches
            .filter((match) => match.mentor_status === 'accepted' && founderAccepted)
            .map((match) => ({
              id: match.id,
              founder_id: match.founder_id,
              mentor_id: match.mentor_id,
              event_id: match.event_id,
              mentor_status: 'accepted',
              founder_status: 'accepted',
              mentor_accepted_at: match.mentor_accepted_at ?? null,
              founder_accepted_at: founderAccepted ? '2026-03-27T00:12:00.000Z' : null,
              created_at: match.created_at,
              mentor: { id: 'mentor-2', name: 'Mentor Two', email: 'mentor2@example.com' },
              event: { id: 'event-1', name: 'Demo Day', publishing_start: '2000-01-01T00:00:00.000Z' },
            })),
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const generateResponse = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 2,
        exclude_previous_pairs_months: 12,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(generateResponse.status).toBe(200);
    expect(await generateResponse.json()).toEqual({ matches_created: 1, conflicts: 1 });

    const patchResponse = await patchMentorMatch(
      buildRequest('http://localhost/api/mentor/matches/match-1', 'PATCH', { action: 'accept' }),
      { params: Promise.resolve({ matchId: 'match-1' }) }
    );
    expect(patchResponse.status).toBe(200);
    expect(await patchResponse.json()).toEqual({
      success: true,
      data: { status: 'accepted', mutual_acceptance: false },
    });

    let founderListResponse = await listFounderMentorMatches(buildRequest('http://localhost/api/founder/matches', 'GET'));
    expect(founderListResponse.status).toBe(200);
    expect((await founderListResponse.json()).data.matches).toHaveLength(0);

    founderAccepted = true;
    const introResult = await handleMentorMatchJob({ match_id: 'match-1', reason: 'mutual_acceptance' });
    expect(introResult.success).toBe(true);

    const introCalls = mockedEnqueueJob.mock.calls.filter(
      (call) => call[0] === 'send_email' && call[1]?.template_name === 'match_accepted'
    );
    expect(introCalls).toHaveLength(2);

    founderListResponse = await listFounderMentorMatches(buildRequest('http://localhost/api/founder/matches', 'GET'));
    expect(founderListResponse.status).toBe(200);
    const founderPayload = await founderListResponse.json();
    expect(founderPayload.data.matches).toHaveLength(1);
    expect(founderPayload.data.matches[0]).toEqual(
      expect.objectContaining({
        mentor_accepted_at: expect.any(String),
        founder_accepted_at: expect.any(String),
      })
    );
  });

  it('supports declined-state retry with a different pairing and allows rerun outside the 12-month window', async () => {
    const createdPairs: Array<{ mentor_id: string; founder_id: string }> = [];
    let recentPairData: Array<{ mentor_id: string; founder_id: string; created_at: string }> = [
      { mentor_id: 'mentor-1', founder_id: 'founder-1', created_at: '2026-03-20T00:00:00.000Z' },
    ];

    mockedRequireAdmin.mockResolvedValue(adminContext as never);
    mockedEnqueueJob.mockResolvedValue({
      id: 'job-mentor-2',
      job_type: 'mentor_match',
      aggregate_id: 'match-1',
      aggregate_type: 'mentor_match',
      payload: {},
      state: 'pending',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      email_id: null,
      error_message: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-03-27T00:00:00.000Z',
      updated_at: '2026-03-27T00:00:00.000Z',
    } as never);

    mockDb.getEventById.mockResolvedValue({
      data: { id: 'event-1', name: 'Demo Day', publishing_start: '2000-01-01T00:00:00.000Z' },
      error: null,
    });
    mockDb.listMentorIdsByEventId
      .mockResolvedValueOnce({ data: ['mentor-1', 'mentor-2'], error: null })
      .mockResolvedValueOnce({ data: ['mentor-1'], error: null });
    mockDb.listFounderIdsByEventId.mockResolvedValue({ data: ['founder-1'], error: null });
    mockDb.listRecentMentorPairs.mockImplementation(async () => ({ data: recentPairData, error: null }));
    mockDb.insertMentorMatch.mockImplementation(async (payload: Record<string, unknown>) => {
      createdPairs.push({ mentor_id: payload.mentor_id as string, founder_id: payload.founder_id as string });
      return {
        data: {
          id: `match-${createdPairs.length}`,
          mentor_id: payload.mentor_id,
          founder_id: payload.founder_id,
          event_id: payload.event_id,
          mentor_status: 'declined',
          founder_status: 'pending',
          mentor_accepted_at: null,
          founder_accepted_at: null,
          declined_by: 'mentor',
          notes: 'declined in prior run',
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-03-27T00:00:00.000Z',
        },
        error: null,
      };
    });

    const firstRun = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 2,
        exclude_previous_pairs_months: 12,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(firstRun.status).toBe(200);
    expect(await firstRun.json()).toEqual({ matches_created: 1, conflicts: 1 });
    expect(createdPairs[0]).toEqual({ mentor_id: 'mentor-2', founder_id: 'founder-1' });

    recentPairData = [];
    const secondRun = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 1,
        exclude_previous_pairs_months: 12,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(secondRun.status).toBe(200);
    expect(await secondRun.json()).toEqual({ matches_created: 1, conflicts: 0 });
    expect(createdPairs).toEqual(
      expect.arrayContaining([
        { mentor_id: 'mentor-2', founder_id: 'founder-1' },
        { mentor_id: 'mentor-1', founder_id: 'founder-1' },
      ])
    );
  });

  it('verifies generated PDF content markers and score-published email copy', async () => {
    mockDb.insertFile.mockResolvedValueOnce({
      data: {
        id: 'file-1',
        owner_id: 'founder-1',
        file_name: 'report-job-pdf.pdf',
        file_type: 'application/pdf',
        file_size: 100,
        storage_path: 'generated-reports/founder-1/report-job-pdf.pdf',
        signed_url_expiry: 604800,
        retention_days: 7,
        is_public: false,
        created_at: '2026-03-27T00:00:00.000Z',
        expires_at: '2026-04-03T00:00:00.000Z',
      },
      error: null,
    });

    const pdfResult = await handlePdfJob(
      { event_id: 'event-1', founder_id: 'founder-1', pitch_id: 'pitch-1', report_type: 'full' },
      { jobId: 'job-pdf' }
    );

    expect(pdfResult.success).toBe(true);
    expect(mockStorage.upload).toHaveBeenCalled();

    const uploadedBuffer = (mockStorage.upload.mock.calls[0] as unknown[])[2] as Buffer;
    const uploadedText = uploadedBuffer.toString('utf8');
    expect(uploadedText).toContain('%PDF-1.4');
    expect(uploadedText).toContain('Founder ID: founder-1');
    expect(uploadedText).toContain('Event ID: event-1');
    expect(uploadedText).toContain('Pitch ID: pitch-1');

    const rendered = renderEmailTemplate('scores_published', {
      name: 'Sam Founder',
      company: 'Aurrin Labs',
      date: '2026-04-20',
      link: 'https://example.test/founder',
      eventSummary: 'Demo Day',
    });

    expect(rendered.text).toContain('Your scores are now available');
    expect(rendered.text).toContain('https://example.test/founder');
    expect(rendered.text).toContain('Demo Day');
  });
});
