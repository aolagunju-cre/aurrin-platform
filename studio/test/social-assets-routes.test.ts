/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { POST as generateSocialAsset } from '../src/app/api/social-assets/generate/route';
import { GET as getSocialAssetStatus } from '../src/app/api/social-assets/[jobId]/status/route';
import { requireAdmin } from '../src/lib/auth/admin';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json', authorization: 'Bearer admin-token' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('social assets routes', () => {
  let mockDb: Record<string, jest.Mock>;
  let mockStorage: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedRequireAdmin.mockReset();
    mockedEnqueueJob.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockDb = {
      queryTable: jest.fn(),
    };
    mockStorage = {
      createSignedUrl: jest.fn(),
      upload: jest.fn(),
      remove: jest.fn(),
    };

    mockedGetSupabaseClient.mockReturnValue({
      db: mockDb as never,
      storage: mockStorage as never,
    });
  });

  it('POST /api/social-assets/generate rejects non-admin callers', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    );

    const response = await generateSocialAsset(
      buildRequest('http://localhost/api/social-assets/generate', 'POST', {
        asset_type: 'profile',
        founder_id: 'founder-1',
        event_id: 'event-1',
        format: 'og',
      })
    );

    expect(response.status).toBe(403);
  });

  it('POST /api/social-assets/generate validates payload', async () => {
    mockedRequireAdmin.mockResolvedValueOnce({
      userId: 'admin-1',
      auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
    });

    const response = await generateSocialAsset(
      buildRequest('http://localhost/api/social-assets/generate', 'POST', {
        asset_type: 'profile',
        founder_id: '',
        event_id: 'event-1',
        format: 'og',
      })
    );

    expect(response.status).toBe(400);
  });

  it('POST /api/social-assets/generate enqueues generate_social_asset and returns job_id', async () => {
    mockedRequireAdmin.mockResolvedValueOnce({
      userId: 'admin-1',
      auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
    });
    mockedEnqueueJob.mockResolvedValueOnce({
      id: 'job-asset-1',
      job_type: 'generate_social_asset',
      aggregate_id: 'profile:founder-1:event-1:og',
      aggregate_type: 'social_asset',
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

    const response = await generateSocialAsset(
      buildRequest('http://localhost/api/social-assets/generate', 'POST', {
        asset_type: 'profile',
        founder_id: 'founder-1',
        event_id: 'event-1',
        format: 'og',
      })
    );

    expect(response.status).toBe(202);
    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'generate_social_asset',
      {
        asset_type: 'profile',
        founder_id: 'founder-1',
        event_id: 'event-1',
        format: 'og',
      },
      {
        aggregate_id: 'profile:founder-1:event-1:og',
        aggregate_type: 'social_asset',
      }
    );

    const payload = await response.json();
    expect(payload.data).toEqual({ job_id: 'job-asset-1' });
  });

  it('GET /api/social-assets/[jobId]/status returns 404 when job is missing', async () => {
    mockedRequireAdmin.mockResolvedValueOnce({
      userId: 'admin-1',
      auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
    });
    mockDb.queryTable.mockResolvedValueOnce({ data: [], error: null });

    const response = await getSocialAssetStatus(buildRequest('http://localhost/api/social-assets/job-1/status', 'GET'), {
      params: Promise.resolve({ jobId: 'job-1' }),
    });

    expect(response.status).toBe(404);
  });

  it('GET /api/social-assets/[jobId]/status reflects pending and processing states', async () => {
    mockedRequireAdmin
      .mockResolvedValueOnce({
        userId: 'admin-1',
        auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
      })
      .mockResolvedValueOnce({
        userId: 'admin-1',
        auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
      });

    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'job-pending',
            state: 'pending',
            payload: {
              asset_type: 'profile',
              founder_id: 'founder-1',
              event_id: 'event-1',
              format: 'twitter',
            },
            error_message: null,
            last_error: null,
            created_at: '2026-03-27T00:00:00.000Z',
            completed_at: null,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'job-processing',
            state: 'processing',
            payload: {
              asset_type: 'profile',
              founder_id: 'founder-1',
              event_id: 'event-1',
              format: 'linkedin',
            },
            error_message: null,
            last_error: null,
            created_at: '2026-03-27T00:00:00.000Z',
            completed_at: null,
          },
        ],
        error: null,
      });

    const pendingResponse = await getSocialAssetStatus(buildRequest('http://localhost/api/social-assets/job-pending/status', 'GET'), {
      params: Promise.resolve({ jobId: 'job-pending' }),
    });
    const pendingPayload = await pendingResponse.json();
    expect(pendingPayload.data.status).toBe('pending');

    const processingResponse = await getSocialAssetStatus(
      buildRequest('http://localhost/api/social-assets/job-processing/status', 'GET'),
      {
        params: Promise.resolve({ jobId: 'job-processing' }),
      }
    );
    const processingPayload = await processingResponse.json();
    expect(processingPayload.data.status).toBe('processing');
  });

  it('GET /api/social-assets/[jobId]/status reflects failed outcomes', async () => {
    mockedRequireAdmin.mockResolvedValueOnce({
      userId: 'admin-1',
      auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
    });
    mockDb.queryTable.mockResolvedValueOnce({
      data: [
        {
          id: 'job-failed',
          state: 'failed',
          payload: {
            asset_type: 'highlight',
            founder_id: 'founder-1',
            event_id: 'event-1',
            format: 'og',
          },
          error_message: 'render failed',
          last_error: 'render failed',
          created_at: '2026-03-27T00:00:00.000Z',
          completed_at: null,
        },
      ],
      error: null,
    });

    const response = await getSocialAssetStatus(buildRequest('http://localhost/api/social-assets/job-failed/status', 'GET'), {
      params: Promise.resolve({ jobId: 'job-failed' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('failed');
    expect(payload.data.error).toBe('render failed');
  });

  it('GET /api/social-assets/[jobId]/status maps dead_letter state to failed', async () => {
    mockedRequireAdmin.mockResolvedValueOnce({
      userId: 'admin-1',
      auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
    });
    mockDb.queryTable.mockResolvedValueOnce({
      data: [
        {
          id: 'job-dead-letter',
          state: 'dead_letter',
          payload: {
            asset_type: 'event',
            founder_id: 'founder-1',
            event_id: 'event-1',
            format: 'linkedin',
          },
          error_message: 'retry exhausted',
          last_error: 'retry exhausted',
          created_at: '2026-03-27T00:00:00.000Z',
          completed_at: null,
        },
      ],
      error: null,
    });

    const response = await getSocialAssetStatus(buildRequest('http://localhost/api/social-assets/job-dead-letter/status', 'GET'), {
      params: Promise.resolve({ jobId: 'job-dead-letter' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('failed');
    expect(payload.data.error).toBe('retry exhausted');
  });

  it('GET /api/social-assets/[jobId]/status includes signed metadata on completed jobs', async () => {
    mockedRequireAdmin.mockResolvedValueOnce({
      userId: 'admin-1',
      auth: { sub: 'admin-1', email: 'admin@example.com', aud: 'authenticated', iat: 0, exp: 1, iss: 'issuer' },
    });
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'job-completed',
            state: 'completed',
            payload: {
              asset_type: 'profile',
              founder_id: 'founder-1',
              event_id: 'event-1',
              format: 'og',
            },
            error_message: null,
            last_error: null,
            created_at: '2026-03-27T00:00:00.000Z',
            completed_at: '2026-03-27T00:05:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            storage_path: 'social-assets/profile/founder-1/event-1/og.png',
            signed_url_expiry: 3600,
          },
        ],
        error: null,
      });
    mockStorage.createSignedUrl.mockResolvedValueOnce({
      signedUrl: 'https://example.test/signed/og.png',
      error: null,
    });

    const response = await getSocialAssetStatus(buildRequest('http://localhost/api/social-assets/job-completed/status', 'GET'), {
      params: Promise.resolve({ jobId: 'job-completed' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('completed');
    expect(payload.data.asset).toEqual(
      expect.objectContaining({
        asset_type: 'profile',
        founder_id: 'founder-1',
        event_id: 'event-1',
        format: 'og',
        open_graph_image_url: 'https://example.test/signed/og.png',
        signed_download: {
          url: 'https://example.test/signed/og.png',
          expires_in: 3600,
        },
        download_action_label: 'Download Share Card',
      })
    );
  });
});
