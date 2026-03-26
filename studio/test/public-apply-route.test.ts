/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/public/apply/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { uploadFile } from '../src/lib/storage/upload';
import { sendEmail } from '../src/lib/email/send';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/storage/upload', () => {
  class UploadError extends Error {
    code: string;

    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    uploadFile: jest.fn(),
    UploadError,
  };
});

jest.mock('../src/lib/email/send', () => ({
  sendEmail: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

function buildRequest(overrides: Record<string, string> = {}, file?: File): NextRequest {
  const formData = new FormData();
  const required = {
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    company_name: 'Acme Inc',
    pitch_summary: 'A'.repeat(120),
    industry: 'Fintech',
    stage: 'Seed',
    ...overrides,
  };

  Object.entries(required).forEach(([key, value]) => formData.append(key, value));
  formData.append('deck_file', file ?? new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }));

  return new NextRequest(new Request('http://localhost/api/public/apply', { method: 'POST', body: formData }));
}

describe('POST /api/public/apply', () => {
  let mockDb: {
    getFounderApplicationById: jest.Mock;
    getFounderApplicationByEmail: jest.Mock;
    insertFounderApplication: jest.Mock;
    updateFounderApplication: jest.Mock;
    getUserByEmail: jest.Mock;
    insertUser: jest.Mock;
    getFounderByUserId: jest.Mock;
    insertFounder: jest.Mock;
  };

  beforeEach(() => {
    mockedUploadFile.mockReset();
    mockedSendEmail.mockReset();

    mockDb = {
      getFounderApplicationById: jest.fn(),
      getFounderApplicationByEmail: jest.fn().mockResolvedValue({ data: null, error: null }),
      insertFounderApplication: jest.fn().mockResolvedValue({
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
      updateFounderApplication: jest.fn().mockResolvedValue({
        data: {
          id: 'app-existing',
          email: 'jane@example.com',
          name: 'Jane Doe',
          full_name: 'Jane Doe',
          company_name: 'Acme Inc',
          pitch_summary: 'A'.repeat(120),
          industry: 'Fintech',
          stage: 'Seed',
          deck_file_id: 'file-2',
          deck_path: 'pitch-decks/public/new-deck.pdf',
          website: null,
          twitter: null,
          linkedin: null,
          status: 'pending',
          assigned_event_id: null,
          application_data: {},
          reviewed_at: null,
          reviewed_by: null,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
      getUserByEmail: jest.fn(),
      insertUser: jest.fn(),
      getFounderByUserId: jest.fn(),
      insertFounder: jest.fn(),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        insertFile: jest.fn(),
        getFile: jest.fn(),
        deleteFile: jest.fn(),
        getExpiredFiles: jest.fn(),
        insertAuditLog: jest.fn(),
        insertOutboxJob: jest.fn(),
        fetchPendingJobs: jest.fn(),
        updateJobState: jest.fn(),
        getFounderApplicationById: mockDb.getFounderApplicationById,
        getFounderApplicationByEmail: mockDb.getFounderApplicationByEmail,
        insertFounderApplication: mockDb.insertFounderApplication,
        updateFounderApplication: mockDb.updateFounderApplication,
        getUserByEmail: mockDb.getUserByEmail,
        insertUser: mockDb.insertUser,
        getFounderByUserId: mockDb.getFounderByUserId,
        insertFounder: mockDb.insertFounder,
      },
    });

    mockedUploadFile.mockResolvedValue({ file_id: 'file-1', path: 'pitch-decks/public/deck.pdf' });
    mockedSendEmail.mockResolvedValue({
      id: 'job-1',
      job_type: 'send_email',
      aggregate_id: 'app-1',
      aggregate_type: 'founder_application',
      payload: {},
      state: 'pending',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('returns validation errors for invalid payload', async () => {
    const response = await POST(buildRequest({ full_name: '', pitch_summary: 'short' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errors.full_name).toBe('Full name is required');
    expect(body.errors.pitch_summary).toContain('100-1000');
    expect(mockedUploadFile).not.toHaveBeenCalled();
  });

  it('returns success without creating a duplicate application submitted in last day', async () => {
    mockDb.getFounderApplicationByEmail.mockResolvedValueOnce({
      data: {
        id: 'app-existing',
        email: 'jane@example.com',
        name: 'Jane Doe',
        full_name: 'Jane Doe',
        company_name: 'Acme Inc',
        pitch_summary: 'A'.repeat(120),
        industry: 'Fintech',
        stage: 'Seed',
        deck_file_id: 'file-existing',
        deck_path: 'pitch-decks/public/existing.pdf',
        website: null,
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
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: 'Application submitted' });
    expect(mockedUploadFile).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('updates an existing application if the last submission was over 1 day ago', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.getFounderApplicationByEmail.mockResolvedValueOnce({
      data: {
        id: 'app-existing',
        email: 'jane@example.com',
        name: 'Jane Doe',
        full_name: 'Jane Doe',
        company_name: 'Acme Inc',
        pitch_summary: 'A'.repeat(120),
        industry: 'Fintech',
        stage: 'Seed',
        deck_file_id: 'file-old',
        deck_path: 'pitch-decks/public/old.pdf',
        website: null,
        twitter: null,
        linkedin: null,
        status: 'pending',
        assigned_event_id: null,
        application_data: {},
        reviewed_at: null,
        reviewed_by: null,
        created_at: twoDaysAgo,
        updated_at: twoDaysAgo,
      },
      error: null,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: 'Application submitted' });
    expect(mockDb.updateFounderApplication).toHaveBeenCalledWith(
      'app-existing',
      expect.objectContaining({ status: 'pending', full_name: 'Jane Doe' })
    );
    expect(mockedUploadFile).toHaveBeenCalledTimes(1);
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
  });

  it('creates application, uploads deck, and enqueues welcome email', async () => {
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: 'Application submitted' });

    expect(mockedUploadFile).toHaveBeenCalledWith(
      expect.any(File),
      'pitch-decks',
      expect.stringMatching(/^public-/)
    );

    expect(mockedSendEmail).toHaveBeenCalledWith(
      'jane@example.com',
      'welcome_founder',
      expect.objectContaining({
        name: 'Jane Doe',
        company: 'Acme Inc',
        application_id: 'app-1',
      }),
    );
  });

  it('rejects non-pdf deck uploads', async () => {
    const badFile = new File(['text'], 'deck.txt', { type: 'text/plain' });
    const response = await POST(buildRequest({}, badFile));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors.deck_file).toBe('Pitch deck must be a PDF');
    expect(mockedUploadFile).not.toHaveBeenCalled();
  });
});
