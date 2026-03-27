/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { POST as generateReport } from '../src/app/api/founder/reports/generate/route';
import { GET as getReportStatus } from '../src/app/api/founder/reports/[reportId]/status/route';
import { GET as downloadReport } from '../src/app/api/founder/reports/[reportId]/download/route';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { getSupabaseClient } from '../src/lib/db/client';

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

describe('founder report APIs', () => {
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
      queryTable: jest.fn(),
      listEventsByIds: jest.fn(),
    };

    mockStorage = {
      upload: jest.fn(),
      remove: jest.fn(),
      createSignedUrl: jest.fn(),
    };

    mockedGetSupabaseClient.mockReturnValue({
      db: mockDb as never,
      storage: mockStorage as never,
    });
  });

  it('returns 401 when generate auth fails', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await generateReport(
      buildRequest('http://localhost/api/founder/reports/generate', 'POST', {
        event_id: 'event-1',
        pitch_id: 'pitch-1',
        report_type: 'full',
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid report_type', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);

    const response = await generateReport(
      buildRequest('http://localhost/api/founder/reports/generate', 'POST', {
        event_id: 'event-1',
        pitch_id: 'pitch-1',
        report_type: 'invalid',
      })
    );

    expect(response.status).toBe(400);
  });

  it('enqueues generation job and returns job_id/status_url', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.queryTable.mockResolvedValueOnce({
      data: [{ id: 'pitch-1', founder_id: 'founder-1', event_id: 'event-1' }],
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

    const response = await generateReport(
      buildRequest('http://localhost/api/founder/reports/generate', 'POST', {
        event_id: 'event-1',
        pitch_id: 'pitch-1',
        report_type: 'full',
      })
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.data).toEqual({
      job_id: 'job-1',
      status_url: '/api/founder/reports/job-1/status',
    });
    expect(payload.message).toBe("Your report is being generated. You'll receive an email when ready.");
  });

  it('returns failed status when report job failed', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.queryTable
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
      .mockResolvedValueOnce({ data: [], error: null });

    const response = await getReportStatus(buildRequest('http://localhost/api/founder/reports/job-1/status', 'GET'), {
      params: Promise.resolve({ reportId: 'job-1' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.status).toBe('failed');
    expect(payload.data.error).toBe('PDF generation failed');
  });

  it('returns signed URL from download endpoint with 7-day fallback', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'job-1',
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
            storage_path: 'generated-reports/founder-1/1710000000000-report-job-1.pdf',
            signed_url_expiry: null,
          },
        ],
        error: null,
      });
    mockStorage.createSignedUrl.mockResolvedValueOnce({
      signedUrl: 'https://example.test/signed/report.pdf',
      error: null,
    });

    const response = await downloadReport(buildRequest('http://localhost/api/founder/reports/job-1/download', 'GET'), {
      params: Promise.resolve({ reportId: 'job-1' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.url).toBe('https://example.test/signed/report.pdf');
    expect(payload.data.expires_in).toBe(7 * 24 * 60 * 60);
  });

  it('returns 403 when founder requests another founder report status', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(founderContext);
    mockDb.queryTable.mockResolvedValueOnce({
      data: [
        {
          id: 'job-1',
          payload: {
            founder_id: 'founder-2',
            event_id: 'event-1',
            pitch_id: 'pitch-1',
            report_type: 'full',
          },
          state: 'completed',
          created_at: '2026-03-27T00:00:00.000Z',
          completed_at: '2026-03-27T00:05:00.000Z',
          error_message: null,
          last_error: null,
        },
      ],
      error: null,
    });

    const response = await getReportStatus(buildRequest('http://localhost/api/founder/reports/job-1/status', 'GET'), {
      params: Promise.resolve({ reportId: 'job-1' }),
    });

    expect(response.status).toBe(403);
  });
});
