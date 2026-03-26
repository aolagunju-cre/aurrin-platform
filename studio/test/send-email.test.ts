/** @jest-environment node */

import { sendEmail } from '../src/lib/email/send';
import { enqueueJob } from '../src/lib/jobs/enqueue';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('sendEmail', () => {
  const mockDb = {
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
  };

  beforeEach(() => {
    mockedEnqueueJob.mockReset();
    mockDb.getUserByEmail.mockReset();
    mockDb.updateUser.mockReset();
    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        getUserByEmail: mockDb.getUserByEmail,
        updateUser: mockDb.updateUser,
      },
    } as never);

    mockDb.getUserByEmail.mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        avatar_url: null,
        unsubscribed: false,
        unsubscribe_token: '11111111-1111-4111-8111-111111111111',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    mockedEnqueueJob.mockResolvedValue({
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
  });

  it('enqueues send_email jobs with the required payload shape', async () => {
    await sendEmail('Jane@Example.com', 'welcome_founder', {
      name: 'Jane Doe',
      company: 'Acme Inc',
      link: 'https://example.com',
    });

    expect(mockedEnqueueJob).toHaveBeenCalledWith('send_email', {
      to: 'jane@example.com',
      template_name: 'welcome_founder',
      data: expect.objectContaining({
        name: 'Jane Doe',
        company: 'Acme Inc',
        unsubscribeToken: '11111111-1111-4111-8111-111111111111',
        email: 'jane@example.com',
      }),
    });
  });

  it('suppresses non-transactional email enqueue for unsubscribed users', async () => {
    mockDb.getUserByEmail.mockResolvedValueOnce({
      data: {
        id: 'user-2',
        email: 'jane@example.com',
        name: 'Jane',
        avatar_url: null,
        unsubscribed: true,
        unsubscribe_token: '22222222-2222-4222-8222-222222222222',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const result = await sendEmail('jane@example.com', 'welcome_founder', {
      name: 'Jane Doe',
    });

    expect(result).toBeNull();
    expect(mockedEnqueueJob).not.toHaveBeenCalled();
  });

  it('does not suppress transactional password_reset messages', async () => {
    mockDb.getUserByEmail.mockResolvedValueOnce({
      data: {
        id: 'user-3',
        email: 'jane@example.com',
        name: 'Jane',
        avatar_url: null,
        unsubscribed: true,
        unsubscribe_token: '33333333-3333-4333-8333-333333333333',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    await sendEmail('jane@example.com', 'password_reset', {
      name: 'Jane Doe',
      link: 'https://example.com/reset',
    });

    expect(mockedEnqueueJob).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown template names', async () => {
    await expect(
      sendEmail('jane@example.com', 'unknown_template', {
        name: 'Jane Doe',
      })
    ).rejects.toThrow('Unknown email template: unknown_template');
  });
});
