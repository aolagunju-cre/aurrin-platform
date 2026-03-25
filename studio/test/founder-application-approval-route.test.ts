/** @jest-environment node */

import { NextRequest } from 'next/server';
import { PATCH } from '../src/app/api/protected/admin/founder-applications/[applicationId]/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;

function buildRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = { authorization: 'Bearer mock-token' }
): NextRequest {
  return new NextRequest(
    new Request('http://localhost/api/protected/admin/founder-applications/app-1', {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    })
  );
}

describe('PATCH /api/protected/admin/founder-applications/[applicationId]', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedEnqueueJob.mockReset();
    mockedExtractTokenFromHeader.mockReset();
    mockedVerifyJWT.mockReset();
    mockedExtractTokenFromHeader.mockImplementation((value) => (value ? 'mock-token' : null));
    mockedVerifyJWT.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });

    mockDb = {
      insertFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      getExpiredFiles: jest.fn(),
      insertAuditLog: jest.fn(),
      insertOutboxJob: jest.fn(),
      fetchPendingJobs: jest.fn(),
      updateJobState: jest.fn(),
      getFounderApplicationById: jest.fn().mockResolvedValue({
        data: {
          id: 'app-1',
          email: 'jane@example.com',
          name: 'Jane Doe',
          full_name: 'Jane Doe',
          company_name: 'Acme Inc',
          pitch_summary: 'A'.repeat(120),
          industry: 'Fintech',
          stage: 'Seed',
          deck_file_id: 'file-1',
          deck_path: 'pitch-decks/public/deck.pdf',
          website: 'https://example.com',
          twitter: null,
          linkedin: null,
          status: 'pending',
          assigned_event_id: null,
          application_data: {},
          reviewed_at: null,
          reviewed_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
      getFounderApplicationByEmail: jest.fn(),
      insertFounderApplication: jest.fn(),
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
          email: 'jane@example.com',
          name: 'Jane Doe',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
          social_proof: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
      getRoleAssignmentsByUserId: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'ra-1',
            user_id: 'admin-1',
            role: 'admin',
            scope: 'global',
            scoped_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          },
        ],
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

  it('requires authenticated admin context header', async () => {
    const response = await PATCH(buildRequest({ status: 'accepted' }, { authorization: '' }), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    expect(response.status).toBe(401);
  });

  it('forbids non-admin callers', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({ data: [], error: null });
    const response = await PATCH(buildRequest({ status: 'accepted' }), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    expect(response.status).toBe(403);
  });

  it('does not allow app_metadata admin claims without global admin role assignment', async () => {
    mockedVerifyJWT.mockResolvedValueOnce({
      sub: 'admin-1',
      email: 'admin@example.com',
      app_metadata: { role: 'admin', roles: ['admin'] },
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({ data: [], error: null });

    const response = await PATCH(buildRequest({ status: 'accepted' }), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });

    expect(response.status).toBe(403);
    expect(mockDb.getFounderApplicationById).not.toHaveBeenCalled();
  });

  it('accepts a pending application and provisions founder account artifacts', async () => {
    const response = await PATCH(buildRequest({ status: 'accepted' }), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDb.updateFounderApplication).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ status: 'accepted', reviewed_by: 'admin-1' })
    );
    expect(mockDb.insertUser).toHaveBeenCalledWith({
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
    expect(mockDb.insertFounder).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', company_name: 'Acme Inc' })
    );
    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'email',
      expect.objectContaining({
        to: 'jane@example.com',
        template: 'founder_email_confirmation',
      }),
      expect.objectContaining({ aggregate_type: 'founder_application' })
    );
  });

  it('requires assigned_event_id when assigning application', async () => {
    const response = await PATCH(buildRequest({ status: 'assigned' }), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    expect(response.status).toBe(400);
  });

  it('blocks invalid status transitions', async () => {
    mockDb.getFounderApplicationById.mockResolvedValueOnce({
      data: {
        id: 'app-1',
        email: 'jane@example.com',
        name: 'Jane Doe',
        full_name: 'Jane Doe',
        company_name: 'Acme Inc',
        pitch_summary: 'A'.repeat(120),
        industry: 'Fintech',
        stage: 'Seed',
        deck_file_id: 'file-1',
        deck_path: 'pitch-decks/public/deck.pdf',
        website: null,
        twitter: null,
        linkedin: null,
        status: 'declined',
        assigned_event_id: null,
        application_data: {},
        reviewed_at: null,
        reviewed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const response = await PATCH(buildRequest({ status: 'accepted' }), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    expect(response.status).toBe(409);
  });

  it('does not persist accepted state when founder provisioning fails', async () => {
    mockDb.insertUser.mockResolvedValueOnce({ data: null, error: new Error('insert failed') });

    const response = await PATCH(buildRequest({ status: 'accepted' }), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    expect(response.status).toBe(500);
    expect(mockDb.updateFounderApplication).not.toHaveBeenCalled();
  });
});
