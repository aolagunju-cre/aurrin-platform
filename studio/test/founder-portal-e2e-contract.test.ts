/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getFounderScores } from '../src/app/api/founder/events/[eventId]/scores/route';
import { GET as getFounderValidation } from '../src/app/api/founder/events/[eventId]/validation/route';
import { POST as generateReport } from '../src/app/api/founder/reports/generate/route';
import { GET as getReportStatus } from '../src/app/api/founder/reports/[reportId]/status/route';
import { GET as downloadReport } from '../src/app/api/founder/reports/[reportId]/download/route';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { getSupabaseClient } from '../src/lib/db/client';
import { handlePdfJob } from '../src/lib/jobs/handlers/pdf';
import { renderEmailTemplate } from '../src/lib/email/templates';

jest.mock('../src/lib/auth/founder', () => ({
  requireFounderOrAdmin: jest.fn(),
  canAccessFounderEvent: jest.fn(() => true),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireFounderOrAdmin = requireFounderOrAdmin as jest.MockedFunction<typeof requireFounderOrAdmin>;
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

  let mockDb: Record<string, jest.Mock>;
  let mockStorage: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedRequireFounderOrAdmin.mockReset();
    mockedEnqueueJob.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockDb = {
      getEventById: jest.fn(),
      queryTable: jest.fn(),
      insertFile: jest.fn(),
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
