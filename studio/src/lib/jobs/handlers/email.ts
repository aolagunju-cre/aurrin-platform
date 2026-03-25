import type { JobResult } from '../types';

/**
 * Email job handler (stub).
 * Will be fully implemented by the Email Infrastructure issue (issue #46).
 * Sends transactional email via Resend.
 */
export interface EmailPayload {
  to: string;
  template: string;
  data?: Record<string, unknown>;
}

export async function handleEmailJob(payload: Record<string, unknown>): Promise<JobResult> {
  const { to, template } = payload as unknown as EmailPayload;
  if (!to || !template) {
    return { success: false, error: 'Email job missing required fields: to, template' };
  }
  // Stub — real Resend integration implemented in issue #46
  return { success: true };
}
