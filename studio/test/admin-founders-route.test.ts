/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getFounderDetail } from '../src/app/api/admin/founders/[id]/route';
import { POST as postSendConfirmation } from '../src/app/api/admin/founders/[id]/send-confirmation/route';
import { PATCH as patchFounderStatus } from '../src/app/api/admin/founders/[id]/status/route';
import { GET as listFounders } from '../src/app/api/admin/founders/route';
import { requireAdmin } from '../src/lib/auth/admin';
import { auditLog } from '../src/lib/audit/log';
import { getSupabaseClient } from '../src/lib/db/client';
import { sendEmail } from '../src/lib/email/send';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn(),
}));

jest.mock('../src/lib/email/send', () => ({
  sendEmail: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedAuditLog = auditLog as jest.MockedFunction<typeof auditLog>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('admin founders routes', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedRequireAdmin.mockReset();
    mockedGetSupabaseClient.mockReset();
    mockedAuditLog.mockReset();
    mockedSendEmail.mockReset();

    mockedRequireAdmin.mockResolvedValue({
      userId: 'admin-1',
      auth: {
        sub: 'admin-1',
        email: 'admin@example.com',
        iat: 0,
        exp: 9999999999,
        aud: 'authenticated',
        iss: 'https://example.supabase.co/auth/v1',
      },
    });

    mockDb = {
      queryTable: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'app-1',
            email: 'founder@example.com',
            name: 'Legacy Name',
            full_name: 'Founder Person',
            status: 'accepted',
            assigned_event_id: 'event-1',
            created_at: '2026-03-20T10:00:00.000Z',
          },
        ],
        error: null,
      }),
      listEvents: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'event-1',
            name: 'Spring Demo Day',
            description: null,
            status: 'upcoming',
            starts_at: '2026-04-01T10:00:00.000Z',
            ends_at: '2026-04-01T12:00:00.000Z',
            config: {},
            created_at: '2026-03-20T10:00:00.000Z',
            updated_at: '2026-03-20T10:00:00.000Z',
          },
        ],
        error: null,
      }),
      getFounderApplicationById: jest.fn().mockResolvedValue({
        data: {
          id: 'app-1',
          email: 'founder@example.com',
          name: 'Legacy Name',
          full_name: 'Founder Person',
          company_name: 'Acme Inc',
          pitch_summary: 'Building an AI-native investment platform',
          industry: 'Fintech',
          stage: 'Seed',
          deck_file_id: null,
          deck_path: null,
          website: 'https://example.com',
          twitter: null,
          linkedin: null,
          status: 'pending',
          assigned_event_id: null,
          application_data: {
            challenge: 'Audience validation quality',
            scores: { judge_average: 8.7 },
            validation_results: { audience_votes: 120 },
          },
          reviewed_at: null,
          reviewed_by: null,
          created_at: '2026-03-20T10:00:00.000Z',
          updated_at: '2026-03-20T10:00:00.000Z',
        },
        error: null,
      }),
      updateFounderApplication: jest.fn().mockResolvedValue({
        data: {
          id: 'app-1',
          status: 'accepted',
          assigned_event_id: null,
        },
        error: null,
      }),
      getUserByEmail: jest.fn().mockResolvedValue({ data: null, error: null }),
      insertUser: jest.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          email: 'founder@example.com',
          name: 'Founder Person',
          avatar_url: null,
          unsubscribed: false,
          unsubscribe_token: null,
          created_at: '2026-03-20T10:00:00.000Z',
          updated_at: '2026-03-20T10:00:00.000Z',
        },
        error: null,
      }),
      getFounderByUserId: jest.fn().mockResolvedValue({ data: null, error: null }),
      insertFounder: jest.fn().mockResolvedValue({
        data: {
          id: 'founder-1',
          user_id: 'user-1',
          company_name: 'Acme Inc',
          tagline: null,
          bio: null,
          website: 'https://example.com',
          pitch_deck_url: null,
          social_proof: null,
          created_at: '2026-03-20T10:00:00.000Z',
          updated_at: '2026-03-20T10:00:00.000Z',
        },
        error: null,
      }),
      insertFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      getExpiredFiles: jest.fn(),
      insertAuditLog: jest.fn(),
      insertOutboxJob: jest.fn(),
      fetchPendingJobs: jest.fn(),
      updateJobState: jest.fn(),
      getFounderApplicationByEmail: jest.fn(),
      getUserById: jest.fn(),
      getRoleAssignmentsByUserId: jest.fn(),
      listRoleAssignments: jest.fn(),
      insertRoleAssignment: jest.fn(),
      deleteRoleAssignment: jest.fn(),
      insertEvent: jest.fn(),
      getEventById: jest.fn(),
      updateEvent: jest.fn(),
      searchUsersByEmail: jest.fn(),
      listRubricTemplates: jest.fn(),
      getRubricTemplateById: jest.fn(),
      insertRubricTemplate: jest.fn(),
      updateRubricTemplate: jest.fn(),
      listRubricVersionsByTemplateId: jest.fn(),
      getLatestRubricVersionByTemplateId: jest.fn(),
      insertRubricVersion: jest.fn(),
      listProducts: jest.fn(),
      getProductById: jest.fn(),
      insertProduct: jest.fn(),
      updateProduct: jest.fn(),
      deleteProduct: jest.fn(),
      listPricesByProductId: jest.fn(),
      getPriceById: jest.fn(),
      insertPrice: jest.fn(),
      updatePrice: jest.fn(),
      deletePrice: jest.fn(),
      getSubscriptionByStripeId: jest.fn(),
      getSubscriptionById: jest.fn(),
      listSubscriptionsByUserId: jest.fn(),
      requestSubscriptionCancellation: jest.fn(),
      upsertSubscription: jest.fn(),
      getTransactionByStripeEventId: jest.fn(),
      insertTransaction: jest.fn(),
      listEntitlementsByUserId: jest.fn(),
      insertEntitlement: jest.fn(),
      getContentById: jest.fn(),
      updateUser: jest.fn(),
      insertFounderApplication: jest.fn(),
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

  it('lists founder applications with the required table contract fields', async () => {
    const response = await listFounders(buildRequest('http://localhost/api/admin/founders', 'GET'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        name: 'Founder Person',
        email: 'founder@example.com',
        application_status: 'Accepted',
        assigned_event: 'Spring Demo Day',
      })
    );
  });

  it('returns founder detail with read-only submitted scores and validation views', async () => {
    const response = await getFounderDetail(buildRequest('http://localhost/api/admin/founders/app-1', 'GET'), {
      params: Promise.resolve({ id: 'app-1' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toEqual(
      expect.objectContaining({
        id: 'app-1',
        status: 'Pending',
        submitted_scores: { judge_average: 8.7 },
        validation_results: { audience_votes: 120 },
      })
    );
  });

  it('rejects invalid status transitions with conflict and does not persist updates', async () => {
    mockDb.getFounderApplicationById.mockResolvedValueOnce({
      data: {
        id: 'app-1',
        email: 'founder@example.com',
        name: 'Legacy Name',
        full_name: 'Founder Person',
        company_name: 'Acme Inc',
        pitch_summary: null,
        industry: null,
        stage: null,
        deck_file_id: null,
        deck_path: null,
        website: null,
        twitter: null,
        linkedin: null,
        status: 'declined',
        assigned_event_id: null,
        application_data: {},
        reviewed_at: null,
        reviewed_by: null,
        created_at: '2026-03-20T10:00:00.000Z',
        updated_at: '2026-03-20T10:00:00.000Z',
      },
      error: null,
    });

    const response = await patchFounderStatus(
      buildRequest('http://localhost/api/admin/founders/app-1/status', 'PATCH', { status: 'accepted' }),
      { params: Promise.resolve({ id: 'app-1' }) }
    );

    expect(response.status).toBe(409);
    expect(mockDb.updateFounderApplication).not.toHaveBeenCalled();
  });

  it('provisions founder account and enqueues confirmation when transitioning to accepted', async () => {
    mockedSendEmail.mockResolvedValueOnce({
      id: 'job-1',
      job_type: 'send_email',
      aggregate_id: 'app-1',
      aggregate_type: 'founder_application',
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
      created_at: '2026-03-20T10:00:00.000Z',
      updated_at: '2026-03-20T10:00:00.000Z',
    });

    const response = await patchFounderStatus(
      buildRequest('http://localhost/api/admin/founders/app-1/status', 'PATCH', { status: 'accepted' }),
      { params: Promise.resolve({ id: 'app-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.insertUser).toHaveBeenCalledWith({
      email: 'founder@example.com',
      name: 'Founder Person',
    });
    expect(mockDb.insertFounder).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', company_name: 'Acme Inc' })
    );
    expect(mockedSendEmail).toHaveBeenCalledWith(
      'founder@example.com',
      'founder_approved',
      expect.objectContaining({ company: 'Acme Inc' })
    );
    expect(mockDb.updateFounderApplication).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ status: 'accepted', reviewed_by: 'admin-1' })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'founder_status_updated',
      'admin-1',
      expect.objectContaining({ resource_type: 'founder_application' }),
      expect.any(Object)
    );
  });

  it('enqueues confirmation email without changing status', async () => {
    mockedSendEmail.mockResolvedValueOnce({
      id: 'job-2',
      job_type: 'send_email',
      aggregate_id: 'app-1',
      aggregate_type: 'founder_application',
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
      created_at: '2026-03-20T10:00:00.000Z',
      updated_at: '2026-03-20T10:00:00.000Z',
    });

    const response = await postSendConfirmation(
      buildRequest('http://localhost/api/admin/founders/app-1/send-confirmation', 'POST'),
      { params: Promise.resolve({ id: 'app-1' }) }
    );

    expect(response.status).toBe(202);
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    expect(mockDb.updateFounderApplication).not.toHaveBeenCalled();
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'founder_confirmation_enqueued',
      'admin-1',
      expect.objectContaining({ resource_type: 'founder_application', resource_id: 'app-1' }),
      expect.any(Object)
    );
  });

  it('returns admin guard response when unauthorized', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await listFounders(buildRequest('http://localhost/api/admin/founders', 'GET'));
    expect(response.status).toBe(401);
  });
});
