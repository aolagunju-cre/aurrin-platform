/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST as submitApplication } from '../src/app/api/public/apply/route';
import { PATCH as reviewApplication } from '../src/app/api/protected/admin/founder-applications/[applicationId]/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { uploadFile } from '../src/lib/storage/upload';
import { sendEmail } from '../src/lib/email/send';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/storage/upload', () => ({
  uploadFile: jest.fn(),
}));

jest.mock('../src/lib/email/send', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;

function buildApplyRequest(): NextRequest {
  const formData = new FormData();
  formData.append('full_name', 'Jane Doe');
  formData.append('email', 'jane@example.com');
  formData.append('company_name', 'Acme Inc');
  formData.append('pitch_summary', 'A'.repeat(120));
  formData.append('industry', 'Fintech');
  formData.append('stage', 'Seed');
  formData.append('deck_file', new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }));

  return new NextRequest(new Request('http://localhost/api/public/apply', { method: 'POST', body: formData }));
}

function buildApproveRequest(applicationId: string): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/protected/admin/founder-applications/${applicationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ status: 'accepted' }),
    })
  );
}

describe('founder application lifecycle integration', () => {
  let applicationsById: Map<string, Record<string, unknown>>;
  let db: Record<string, jest.Mock>;

  beforeEach(() => {
    applicationsById = new Map();

    mockedUploadFile.mockReset();
    mockedSendEmail.mockReset();
    mockedExtractTokenFromHeader.mockReset();
    mockedVerifyJWT.mockReset();

    mockedUploadFile.mockResolvedValue({
      file_id: 'file-1',
      path: 'pitch-decks/public/deck.pdf',
    });
    mockedSendEmail.mockResolvedValue({
      id: 'job-1',
      job_type: 'send_email',
      aggregate_id: null,
      aggregate_type: null,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockedExtractTokenFromHeader.mockImplementation((header) => (header ? 'admin-token' : null));
    mockedVerifyJWT.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });

    db = {
      getFounderApplicationById: jest.fn().mockImplementation(async (id: string) => ({
        data: applicationsById.get(id) ?? null,
        error: null,
      })),
      getFounderApplicationByEmail: jest.fn().mockImplementation(async (email: string) => ({
        data: [...applicationsById.values()].find((record) => record.email === email) ?? null,
        error: null,
      })),
      insertFounderApplication: jest.fn().mockImplementation(async (payload: Record<string, unknown>) => {
        const created = {
          id: 'app-1',
          status: 'pending',
          assigned_event_id: null,
          reviewed_at: null,
          reviewed_by: null,
          website: null,
          twitter: null,
          linkedin: null,
          application_data: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload,
        };
        applicationsById.set('app-1', created);
        return { data: created, error: null };
      }),
      updateFounderApplication: jest.fn().mockImplementation(async (id: string, updates: Record<string, unknown>) => {
        const current = applicationsById.get(id);
        if (!current) {
          return { data: null, error: null };
        }

        const next = {
          ...current,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        applicationsById.set(id, next);
        return { data: next, error: null };
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
          website: null,
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
      db: db as never,
    });
  });

  it('submits a founder application and then approves it through admin review', async () => {
    const submitResponse = await submitApplication(buildApplyRequest());
    expect(submitResponse.status).toBe(200);

    const storedApplication = applicationsById.get('app-1');
    expect(storedApplication).toBeDefined();
    expect(storedApplication?.status).toBe('pending');

    const approveResponse = await reviewApplication(buildApproveRequest('app-1'), {
      params: Promise.resolve({ applicationId: 'app-1' }),
    });

    expect(approveResponse.status).toBe(200);
    expect(applicationsById.get('app-1')?.status).toBe('accepted');
    expect(db.updateFounderApplication).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ status: 'accepted', reviewed_by: 'admin-1' })
    );
    expect(mockedSendEmail).toHaveBeenCalledWith(
      'jane@example.com',
      'founder_approved',
      expect.objectContaining({ company: 'Acme Inc' })
    );
  });
});
