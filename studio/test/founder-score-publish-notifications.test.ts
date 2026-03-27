/** @jest-environment node */

import { enqueueScorePublishNotifications } from '../src/lib/events/score-publish-notifications';
import { getSupabaseClient } from '../src/lib/db/client';
import { enqueueJob } from '../src/lib/jobs/enqueue';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;

describe('enqueueScorePublishNotifications', () => {
  beforeEach(() => {
    mockedGetSupabaseClient.mockReset();
    mockedEnqueueJob.mockReset();
    process.env.APP_BASE_URL = 'https://portal.example.com';
  });

  afterEach(() => {
    delete process.env.APP_BASE_URL;
  });

  it('enqueues one notification per eligible founder/event with required copy context', async () => {
    const mockDb = {
      queryTable: jest.fn()
        .mockResolvedValueOnce({
          data: [{ id: 'event-1', name: 'Founder Finals', publishing_start: '2026-03-20T00:00:00.000Z' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              founder_id: 'founder-1',
              event_id: 'event-1',
              founder: {
                company_name: 'Orbit Labs',
                user: { email: 'founder@example.com', name: 'Sam Founder' },
              },
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [],
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

    mockedEnqueueJob.mockResolvedValue({
      id: 'job-1',
      job_type: 'send_email',
      aggregate_id: 'event-1:founder-1',
      aggregate_type: 'scores_published_notification',
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

    const queued = await enqueueScorePublishNotifications(new Date('2026-03-21T00:00:00.000Z'));
    expect(queued).toBe(1);

    expect(mockedEnqueueJob).toHaveBeenCalledWith(
      'send_email',
      expect.objectContaining({
        to: 'founder@example.com',
        template_name: 'scores_published',
        data: expect.objectContaining({
          eventSummary: 'Founder Finals',
          link: 'https://portal.example.com/founder/events/event-1/pitch',
        }),
      }),
      expect.objectContaining({
        aggregate_id: 'event-1:founder-1',
        aggregate_type: 'scores_published_notification',
      })
    );
  });

  it('does not enqueue duplicates when an aggregate notification already exists', async () => {
    const mockDb = {
      queryTable: jest.fn()
        .mockResolvedValueOnce({
          data: [{ id: 'event-1', name: 'Founder Finals', publishing_start: '2026-03-20T00:00:00.000Z' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              founder_id: 'founder-1',
              event_id: 'event-1',
              founder: {
                company_name: 'Orbit Labs',
                user: { email: 'founder@example.com', name: 'Sam Founder' },
              },
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ aggregate_id: 'event-1:founder-1' }],
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

    const queued = await enqueueScorePublishNotifications(new Date('2026-03-21T00:00:00.000Z'));
    expect(queued).toBe(0);
    expect(mockedEnqueueJob).not.toHaveBeenCalled();
  });
});
