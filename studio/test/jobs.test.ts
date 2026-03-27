import { setSupabaseClient, resetSupabaseClient } from '../src/lib/db/client';
import type { SupabaseClient, OutboxJob } from '../src/lib/db/client';
import type { OutboxJobState } from '../src/lib/jobs/types';
import { DEFAULT_MAX_RETRIES, RETRY_BACKOFF_SECONDS } from '../src/lib/jobs/types';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { processPendingJobs } from '../src/lib/jobs/processor';
import { handleEmailJob, resetResendClientFactory, setResendClientFactory } from '../src/lib/jobs/handlers/email';
import { handlePdfJob } from '../src/lib/jobs/handlers/pdf';
import { handleAssetJob } from '../src/lib/jobs/handlers/asset';
import { handleMentorMatchJob } from '../src/lib/jobs/handlers/mentor-match';
import { handleWebhookJob } from '../src/lib/jobs/handlers/webhook';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: 'job-1',
    job_type: 'email',
    aggregate_id: null,
    aggregate_type: null,
    payload: { to: 'a@b.com', template: 'welcome_founder' },
    state: 'pending',
    retry_count: 0,
    max_retries: DEFAULT_MAX_RETRIES,
    last_error: null,
    email_id: null,
    error_message: null,
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeClient(overrides: Partial<SupabaseClient['db']> = {}): SupabaseClient {
  const db: SupabaseClient['db'] = {
    insertFile: jest.fn().mockResolvedValue({
      data: {
        id: 'file-1',
        owner_id: 'owner-1',
        file_name: 'file.pdf',
        file_type: 'application/pdf',
        file_size: 10,
        storage_path: 'generated-reports/owner-1/file.pdf',
        signed_url_expiry: 3600,
        retention_days: 7,
        is_public: false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      error: null,
    }),
    getFile: jest.fn().mockResolvedValue({ data: null, error: null }),
    deleteFile: jest.fn().mockResolvedValue({ error: null }),
    getExpiredFiles: jest.fn().mockResolvedValue({ data: [], error: null }),
    deleteExpiredAudienceSessions: jest.fn().mockResolvedValue({ deleted: 0, error: null }),
    insertAuditLog: jest.fn().mockResolvedValue({ error: null }),
    insertOutboxJob: jest.fn().mockResolvedValue({ data: makeJob(), error: null }),
    fetchPendingJobs: jest.fn().mockResolvedValue({ data: [], error: null }),
    updateJobState: jest.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  return {
    storage: {
      upload: jest.fn().mockResolvedValue({ path: '', error: null }),
      remove: jest.fn().mockResolvedValue({ error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ signedUrl: '', error: null }),
    },
    db,
  };
}

// ─── Types & Constants ────────────────────────────────────────────────────────

describe('OutboxJob types', () => {
  it('DEFAULT_MAX_RETRIES matches schema default of 3', () => {
    expect(DEFAULT_MAX_RETRIES).toBe(3);
  });

  it('RETRY_BACKOFF_SECONDS has at least 3 entries', () => {
    expect(RETRY_BACKOFF_SECONDS.length).toBeGreaterThanOrEqual(3);
    expect(RETRY_BACKOFF_SECONDS[0]).toBe(60);    // 1 min
    expect(RETRY_BACKOFF_SECONDS[1]).toBe(300);   // 5 min
    expect(RETRY_BACKOFF_SECONDS[2]).toBe(900);   // 15 min
  });
});

// ─── enqueueJob ───────────────────────────────────────────────────────────────

describe('enqueueJob', () => {
  afterEach(() => resetSupabaseClient());

  it('inserts a pending outbox job and returns it', async () => {
    const expectedJob = makeJob({ job_type: 'email' });
    const client = makeClient({
      insertOutboxJob: jest.fn().mockResolvedValue({ data: expectedJob, error: null }),
    });
    setSupabaseClient(client);

    const result = await enqueueJob('email', { to: 'x@y.com', template: 'test' });

    expect(client.db.insertOutboxJob).toHaveBeenCalledWith(
      expect.objectContaining({ job_type: 'email' })
    );
    expect(result.id).toBe('job-1');
    expect(result.state).toBe('pending');
  });

  it('supports send_email outbox payload contract', async () => {
    const client = makeClient();
    setSupabaseClient(client);

    await enqueueJob('send_email', {
      to: 'founder@example.com',
      template_name: 'welcome_founder',
      data: { name: 'Founder' },
    });

    expect(client.db.insertOutboxJob).toHaveBeenCalledWith(
      expect.objectContaining({
        job_type: 'send_email',
        payload: {
          to: 'founder@example.com',
          template_name: 'welcome_founder',
          data: { name: 'Founder' },
        },
      })
    );
  });

  it('passes aggregate_id and aggregate_type when provided', async () => {
    const client = makeClient();
    setSupabaseClient(client);

    await enqueueJob('mentor_match', { event_id: 'e1', founder_id: 'f1' }, {
      aggregate_id: 'e1',
      aggregate_type: 'event',
    });

    expect(client.db.insertOutboxJob).toHaveBeenCalledWith(
      expect.objectContaining({ aggregate_id: 'e1', aggregate_type: 'event' })
    );
  });

  it('passes scheduled_at when provided', async () => {
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    const client = makeClient();
    setSupabaseClient(client);

    await enqueueJob('pdf_generate', { event_id: 'e1', founder_id: 'f1' }, { scheduled_at: scheduledAt });

    expect(client.db.insertOutboxJob).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_at: scheduledAt })
    );
  });

  it('throws when the DB returns an error', async () => {
    const client = makeClient({
      insertOutboxJob: jest.fn().mockResolvedValue({ data: null, error: new Error('DB down') }),
    });
    setSupabaseClient(client);

    await expect(enqueueJob('email', { to: 'x@y.com', template: 'test' }))
      .rejects.toThrow('Failed to enqueue job');
  });
});

// ─── processPendingJobs ───────────────────────────────────────────────────────

describe('processPendingJobs', () => {
  let mockResendSend: jest.Mock;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    mockResendSend = jest.fn().mockResolvedValue({
      data: { id: 'email_123' },
      error: null,
    });
    setResendClientFactory(() => ({
      emails: {
        send: mockResendSend,
      },
    }));
  });

  afterEach(() => {
    resetSupabaseClient();
    resetResendClientFactory();
    delete process.env.RESEND_API_KEY;
  });

  it('returns zero stats when no pending jobs', async () => {
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, dead: 0 });
  });

  it('marks send_email job as completed on provider success and stores email_id', async () => {
    const job = makeJob({
      job_type: 'send_email',
      payload: {
        to: 'a@b.com',
        template_name: 'welcome_founder',
        data: { name: 'Founder' },
      },
    });
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: [job], error: null }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
      })
    );
    expect(client.db.updateJobState).toHaveBeenCalledWith(
      job.id,
      'completed',
      expect.objectContaining({ completed_at: expect.any(String), email_id: 'email_123', error_message: null })
    );
  });

  it('marks job as failed with backoff when handler returns failure', async () => {
    const job = makeJob({ job_type: 'email', payload: {} }); // missing fields → handler fails
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: [job], error: null }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();

    expect(result.failed).toBe(1);
    const updateCalls = (client.db.updateJobState as jest.Mock).mock.calls;
    const finalCall = updateCalls[updateCalls.length - 1];
    expect(finalCall[1]).toBe('failed');
    expect(finalCall[2]).toMatchObject({
      error_message: expect.any(String),
      retry_count: 1,
      scheduled_at: expect.any(String),
    });
  });

  it('moves job to dead_letter when provider failure reaches max_retries', async () => {
    mockResendSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Provider timeout' },
    });
    // retry_count = 2, max_retries = 3 -> next attempt (3) >= max_retries (3) -> dead_letter
    const job = makeJob({
      id: 'send-email-dead',
      job_type: 'send_email',
      payload: { to: 'a@b.com', template_name: 'welcome_founder' },
      retry_count: 2,
      max_retries: 3,
    });
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: [job], error: null }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();

    expect(result.dead).toBe(1);
    const updateCalls = (client.db.updateJobState as jest.Mock).mock.calls;
    const finalCall = updateCalls[updateCalls.length - 1];
    expect(finalCall[1]).toBe('dead_letter');
    expect(finalCall[2]).toMatchObject({
      error_message: 'Provider timeout',
      retry_count: 3,
    });
  });

  it('returns empty stats when fetchPendingJobs fails', async () => {
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: [], error: new Error('DB error') }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, dead: 0 });
  });

  it('processes multiple jobs in a batch', async () => {
    const jobs = [
      makeJob({ id: 'j1', job_type: 'email', payload: { to: 'a@b.com', template: 'welcome_founder' } }),
      makeJob({ id: 'j2', job_type: 'email', payload: { to: 'c@d.com', template: 'welcome_founder' } }),
    ];
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: jobs, error: null }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
  });

  it('dispatches send_email jobs without regressing legacy email jobs', async () => {
    const jobs = [
      makeJob({
        id: 'send-email-job',
        job_type: 'send_email',
        payload: { to: 'a@b.com', template: 'welcome_founder' },
      }),
      makeJob({
        id: 'legacy-email-job',
        job_type: 'email',
        payload: { to: 'c@d.com', template: 'welcome_founder' },
      }),
    ];
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: jobs, error: null }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(client.db.updateJobState).toHaveBeenCalledWith(
      'send-email-job',
      'completed',
      expect.objectContaining({ email_id: 'email_123', error_message: null })
    );
    expect(client.db.updateJobState).toHaveBeenCalledWith(
      'legacy-email-job',
      'completed',
      expect.objectContaining({ email_id: 'email_123', error_message: null })
    );
  });

  it('persists error_message when provider send fails', async () => {
    mockResendSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Resend provider unavailable' },
    });
    const job = makeJob({
      id: 'send-email-job',
      job_type: 'send_email',
      payload: { to: 'a@b.com', template_name: 'welcome_founder' },
    });
    const client = makeClient({
      fetchPendingJobs: jest.fn().mockResolvedValue({ data: [job], error: null }),
    });
    setSupabaseClient(client);

    const result = await processPendingJobs();

    expect(result.failed).toBe(1);
    expect(client.db.updateJobState).toHaveBeenCalledWith(
      'send-email-job',
      'failed',
      expect.objectContaining({
        error_message: 'Resend provider unavailable',
        retry_count: 1,
        scheduled_at: expect.any(String),
      })
    );
  });
});

// ─── Job Handlers ─────────────────────────────────────────────────────────────

describe('handleEmailJob', () => {
  let mockResendSend: jest.Mock;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    mockResendSend = jest.fn().mockResolvedValue({
      data: { id: 'email_123' },
      error: null,
    });
    setResendClientFactory(() => ({
      emails: {
        send: mockResendSend,
      },
    }));
  });

  afterEach(() => {
    resetResendClientFactory();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_REPLY_TO_EMAIL;
    jest.restoreAllMocks();
  });

  it('returns success with valid payload', async () => {
    const result = await handleEmailJob(
      { to: 'a@b.com', template: 'welcome_founder', data: { name: 'A' } },
      { jobId: 'job-123' }
    );
    expect(result.success).toBe(true);
    expect(result.email_id).toBe('email_123');
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@aurrin.ventures',
        replyTo: 'support@aurrin.ventures',
        to: 'a@b.com',
      })
    );
  });

  it('returns failure when required fields missing', async () => {
    const result = await handleEmailJob({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/to.*template/i);
  });

  it('returns deterministic failure when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;

    const result = await handleEmailJob({ to: 'a@b.com', template: 'welcome_founder' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('RESEND_API_KEY is required for send_email jobs');
  });

  it('returns provider failure message and does not throw', async () => {
    mockResendSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Provider denied request' },
    });

    const result = await handleEmailJob({ to: 'a@b.com', template: 'welcome_founder' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Provider denied request');
  });

  it('emits structured log fields for completion', async () => {
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    await handleEmailJob({ to: 'a@b.com', template: 'welcome_founder' }, { jobId: 'job-42' });

    const logEntry = JSON.parse(String(writeSpy.mock.calls[0][0]));
    expect(logEntry.context).toMatchObject({
      to: 'a@b.com',
      template: 'welcome_founder',
      job_id: 'job-42',
      status: 'success',
      duration: expect.any(Number),
    });
  });
});

describe('handlePdfJob', () => {
  afterEach(() => {
    resetSupabaseClient();
  });

  it('returns success with valid payload', async () => {
    const client = makeClient();
    setSupabaseClient(client);

    const result = await handlePdfJob(
      { event_id: 'e1', founder_id: 'f1', pitch_id: 'p1', report_type: 'full' },
      { jobId: 'job-123' }
    );

    expect(result.success).toBe(true);
    expect(client.storage.upload).toHaveBeenCalledWith(
      'generated-reports',
      expect.stringContaining('report-job-123.pdf'),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/pdf' })
    );
    expect(client.db.insertFile).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'f1',
        file_name: 'report-job-123.pdf',
        storage_path: expect.stringContaining('generated-reports/f1/'),
      })
    );
  });

  it('returns failure when required fields missing', async () => {
    const client = makeClient();
    setSupabaseClient(client);

    const result = await handlePdfJob({ event_id: 'e1' });
    expect(result.success).toBe(false);
  });
});

describe('handleAssetJob', () => {
  it('returns success with valid payload', async () => {
    const result = await handleAssetJob({ founder_id: 'f1', event_id: 'e1', asset_type: 'og_image' });
    expect(result.success).toBe(true);
  });

  it('returns failure when required fields missing', async () => {
    const result = await handleAssetJob({ event_id: 'e1' });
    expect(result.success).toBe(false);
  });
});

describe('handleMentorMatchJob', () => {
  afterEach(() => {
    resetSupabaseClient();
  });

  it('enqueues mentor/founder notifications and 7-day reminders when pending and publishing is open', async () => {
    const createdAt = '2026-03-20T10:00:00.000Z';
    const match = {
      id: 'match-1',
      mentor_id: 'mentor-1',
      founder_id: 'founder-1',
      event_id: 'event-1',
      mentor_status: 'pending',
      founder_status: 'pending',
      created_at: createdAt,
    };

    const client = makeClient({
      getMentorMatchById: jest.fn().mockResolvedValue({ data: match, error: null }),
      getUserById: jest.fn()
        .mockResolvedValueOnce({ data: { id: 'mentor-1', email: 'mentor@example.com', name: 'Mentor Max' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'founder-user-1', email: 'founder@example.com', name: 'Founder One' }, error: null }),
      queryTable: jest.fn().mockResolvedValue({ data: [{ id: 'founder-1', user_id: 'founder-user-1', company_name: 'Acme' }], error: null }),
      getEventById: jest.fn().mockResolvedValue({ data: { id: 'event-1', publishing_start: '2026-03-01T00:00:00.000Z' }, error: null }),
      insertOutboxJob: jest.fn().mockImplementation(async (job) => ({ data: makeJob({ job_type: job.job_type, payload: job.payload }), error: null })),
    });
    setSupabaseClient(client);

    const result = await handleMentorMatchJob({ match_id: 'match-1', reason: 'match_created' });

    expect(result.success).toBe(true);
    expect(client.db.insertOutboxJob).toHaveBeenCalledTimes(4);

    const insertCalls = (client.db.insertOutboxJob as jest.Mock).mock.calls.map((call) => call[0]);
    const reminderJobs = insertCalls.filter((job) => job.payload.template_name === 'match_reminder');
    expect(reminderJobs).toHaveLength(2);
    for (const reminderJob of reminderJobs) {
      expect(reminderJob.scheduled_at).toBe('2026-03-27T10:00:00.000Z');
    }
  });

  it('does not enqueue founder notifications before publishing opens', async () => {
    const client = makeClient({
      getMentorMatchById: jest.fn().mockResolvedValue({
        data: {
          id: 'match-2',
          mentor_id: 'mentor-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'pending',
          founder_status: 'pending',
          created_at: '2026-03-20T10:00:00.000Z',
        },
        error: null,
      }),
      getUserById: jest.fn()
        .mockResolvedValueOnce({ data: { id: 'mentor-1', email: 'mentor@example.com', name: 'Mentor Max' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'founder-user-1', email: 'founder@example.com', name: 'Founder One' }, error: null }),
      queryTable: jest.fn().mockResolvedValue({ data: [{ id: 'founder-1', user_id: 'founder-user-1', company_name: 'Acme' }], error: null }),
      getEventById: jest.fn().mockResolvedValue({ data: { id: 'event-1', publishing_start: '2099-01-01T00:00:00.000Z' }, error: null }),
      insertOutboxJob: jest.fn().mockImplementation(async (job) => ({ data: makeJob({ job_type: job.job_type, payload: job.payload }), error: null })),
    });
    setSupabaseClient(client);

    const result = await handleMentorMatchJob({ match_id: 'match-2' });
    expect(result.success).toBe(true);

    const insertCalls = (client.db.insertOutboxJob as jest.Mock).mock.calls.map((call) => call[0]);
    const founderJobs = insertCalls.filter((job) => job.payload.to === 'founder@example.com');
    expect(founderJobs).toHaveLength(0);
  });

  it('enqueues intro emails for mutual acceptance', async () => {
    const client = makeClient({
      getMentorMatchById: jest.fn().mockResolvedValue({
        data: {
          id: 'match-3',
          mentor_id: 'mentor-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'accepted',
          founder_status: 'accepted',
          created_at: '2026-03-20T10:00:00.000Z',
        },
        error: null,
      }),
      getUserById: jest.fn()
        .mockResolvedValueOnce({ data: { id: 'mentor-1', email: 'mentor@example.com', name: 'Mentor Max' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'founder-user-1', email: 'founder@example.com', name: 'Founder One' }, error: null }),
      queryTable: jest.fn().mockResolvedValue({ data: [{ id: 'founder-1', user_id: 'founder-user-1', company_name: 'Acme' }], error: null }),
      getEventById: jest.fn().mockResolvedValue({ data: { id: 'event-1', publishing_start: '2026-03-01T00:00:00.000Z' }, error: null }),
      insertOutboxJob: jest.fn().mockImplementation(async (job) => ({ data: makeJob({ job_type: job.job_type, payload: job.payload }), error: null })),
    });
    setSupabaseClient(client);

    const result = await handleMentorMatchJob({ match_id: 'match-3', reason: 'mutual_acceptance' });
    expect(result.success).toBe(true);

    const insertCalls = (client.db.insertOutboxJob as jest.Mock).mock.calls.map((call) => call[0]);
    expect(insertCalls).toHaveLength(2);
    for (const job of insertCalls) {
      expect(job.payload.template_name).toBe('match_accepted');
    }
  });

  it('returns failure when required fields are missing', async () => {
    const result = await handleMentorMatchJob({ event_id: 'e1' });
    expect(result.success).toBe(false);
  });
});

describe('handleWebhookJob', () => {
  it('returns success with valid payload', async () => {
    const result = await handleWebhookJob({ event_type: 'charge.succeeded', event_id: 'evt_123', data: {} });
    expect(result.success).toBe(true);
  });

  it('returns failure when required fields missing', async () => {
    const result = await handleWebhookJob({ event_type: 'charge.succeeded' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/event_id/);
  });
});
