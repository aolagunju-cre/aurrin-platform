/** @jest-environment node */

import { sendEmail } from '../src/lib/email/send';
import { enqueueJob } from '../src/lib/jobs/enqueue';

jest.mock('../src/lib/jobs/enqueue', () => ({
  enqueueJob: jest.fn(),
}));

const mockedEnqueueJob = enqueueJob as jest.MockedFunction<typeof enqueueJob>;

describe('sendEmail', () => {
  beforeEach(() => {
    mockedEnqueueJob.mockReset();
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
      }),
    });
  });

  it('rejects unknown template names', async () => {
    await expect(
      sendEmail('jane@example.com', 'unknown_template', {
        name: 'Jane Doe',
      })
    ).rejects.toThrow('Unknown email template: unknown_template');
  });
});
