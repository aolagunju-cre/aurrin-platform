/** @jest-environment node */

import { GET } from '../src/app/api/cron/jobs/route';
import { processPendingJobs } from '../src/lib/jobs/processor';
import { enqueueHourlySubscriptionReconciliation } from '../src/lib/jobs/reconciliation-scheduler';
import { getSupabaseClient } from '../src/lib/db/client';
import { enqueueScorePublishNotifications } from '../src/lib/events/score-publish-notifications';

jest.mock('../src/lib/jobs/processor', () => ({
  processPendingJobs: jest.fn(),
}));

jest.mock('../src/lib/jobs/reconciliation-scheduler', () => ({
  enqueueHourlySubscriptionReconciliation: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/events/score-publish-notifications', () => ({
  enqueueScorePublishNotifications: jest.fn(),
}));

const mockedProcessPendingJobs = processPendingJobs as jest.MockedFunction<typeof processPendingJobs>;
const mockedEnqueueHourlySubscriptionReconciliation =
  enqueueHourlySubscriptionReconciliation as jest.MockedFunction<typeof enqueueHourlySubscriptionReconciliation>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedEnqueueScorePublishNotifications =
  enqueueScorePublishNotifications as jest.MockedFunction<typeof enqueueScorePublishNotifications>;

describe('cron jobs route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        deleteExpiredAudienceSessions: jest.fn().mockResolvedValue({ deleted: 2, error: null }),
      },
    } as never);

    mockedEnqueueHourlySubscriptionReconciliation.mockResolvedValue(true);
    mockedEnqueueScorePublishNotifications.mockResolvedValue(5);
    mockedProcessPendingJobs.mockResolvedValue({ processed: 3, succeeded: 3, failed: 0, dead: 0 });
  });

  it('returns unauthorized when cron secret does not match', async () => {
    process.env.CRON_SECRET = 'expected-secret';

    const response = await GET(new Request('http://localhost/api/cron/jobs'));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('cleans expired audience sessions before processing jobs', async () => {
    const response = await GET(new Request('http://localhost/api/cron/jobs'));
    expect(response.status).toBe(200);
    expect(mockedGetSupabaseClient).toHaveBeenCalledTimes(1);

    const dbClient = mockedGetSupabaseClient.mock.results[0]?.value.db as {
      deleteExpiredAudienceSessions: jest.Mock;
    };
    expect(dbClient.deleteExpiredAudienceSessions).toHaveBeenCalledWith(expect.any(Date));
    expect(mockedEnqueueHourlySubscriptionReconciliation).toHaveBeenCalledTimes(1);
    expect(mockedEnqueueScorePublishNotifications).toHaveBeenCalledTimes(1);
    expect(mockedProcessPendingJobs).toHaveBeenCalledTimes(1);

    expect(await response.json()).toEqual({
      ok: true,
      expiredAudienceSessionsDeleted: 2,
      scoresPublishedNotificationsQueued: 5,
      processed: 3,
      succeeded: 3,
      failed: 0,
      dead: 0,
    });
  });
});
