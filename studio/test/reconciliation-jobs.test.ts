/** @jest-environment node */

import { enqueueJob } from '../src/lib/jobs/enqueue';
import { resetSupabaseClient, setSupabaseClient } from '../src/lib/db/client';
import { processPendingJobs } from '../src/lib/jobs/processor';
import { enqueueHourlySubscriptionReconciliation } from '../src/lib/jobs/reconciliation-scheduler';
import { reconcileStripeSubscriptions } from '../src/lib/payments/reconciliation';

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/payments/reconciliation', () => ({
  ...jest.requireActual('../src/lib/payments/reconciliation'),
  reconcileStripeSubscriptions: jest.fn(),
}));

const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
const mockedReconcileStripeSubscriptions = reconcileStripeSubscriptions as jest.MockedFunction<typeof reconcileStripeSubscriptions>;

describe('enqueueHourlySubscriptionReconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues reconciliation on the top of the hour', async () => {
    mockedEnqueueJob.mockResolvedValueOnce({
      id: 'job-1',
      job_type: 'subscription_reconcile',
      aggregate_id: 'subscription_reconcile:2026-03-26T14',
      aggregate_type: 'subscription_reconcile',
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

    const enqueued = await enqueueHourlySubscriptionReconciliation(new Date('2026-03-26T14:00:00.000Z'));

    expect(enqueued).toBe(true);
    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'subscription_reconcile',
      expect.objectContaining({
        trigger: 'hourly_cron',
        hour: '2026-03-26T14',
      }),
      expect.objectContaining({
        aggregate_id: 'subscription_reconcile:2026-03-26T14',
      })
    );
  });

  it('does not enqueue outside the top of hour', async () => {
    const enqueued = await enqueueHourlySubscriptionReconciliation(new Date('2026-03-26T14:05:00.000Z'));

    expect(enqueued).toBe(false);
    expect(mockedEnqueueJob).not.toHaveBeenCalled();
  });
});

describe('processPendingJobs subscription reconciliation dispatch', () => {
  afterEach(() => {
    resetSupabaseClient();
    jest.clearAllMocks();
  });

  it('processes subscription_reconcile jobs successfully', async () => {
    mockedReconcileStripeSubscriptions.mockResolvedValueOnce({
      checked: 1,
      corrected: 1,
      notificationsQueued: 1,
    });

    const client = {
      storage: {
        upload: jest.fn().mockResolvedValue({ path: '', error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ signedUrl: '', error: null }),
      },
      db: {
        fetchPendingJobs: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'job-reconcile-1',
              job_type: 'subscription_reconcile',
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
            },
          ],
          error: null,
        }),
        updateJobState: jest.fn().mockResolvedValue({ error: null }),
      },
    };

    setSupabaseClient(client as never);

    const result = await processPendingJobs();

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0, dead: 0 });
    expect(client.db.updateJobState).toHaveBeenCalledWith(
      'job-reconcile-1',
      'completed',
      expect.objectContaining({
        completed_at: expect.any(String),
      })
    );
  });
});
