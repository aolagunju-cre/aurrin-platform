import { renderEmailTemplate, isEmailTemplateName } from '../../email/templates';
import { logger } from '../../logging/logger';
import type { JobResult } from '../types';

/**
 * Email job handler (stub).
 * Will be fully implemented by the Email Infrastructure issue (issue #46).
 * Sends transactional email via Resend.
 */
export interface EmailPayload {
  to: string;
  template?: string;
  template_name?: string;
  data?: Record<string, unknown>;
}

export interface EmailJobContext {
  jobId?: string;
}

export interface ResendResponseLike {
  data?: {
    id?: string;
  } | null;
  error?: {
    message?: string;
  } | null;
}

export interface ResendClientLike {
  emails: {
    send: (payload: {
      from: string;
      to: string | string[];
      replyTo: string;
      subject: string;
      html: string;
      text: string;
    }) => Promise<ResendResponseLike>;
  };
}

const DEFAULT_FROM_EMAIL = 'noreply@aurrin.ventures';
const DEFAULT_REPLY_TO_EMAIL = 'support@aurrin.ventures';

function createDefaultResendClient(apiKey: string): ResendClientLike {
  const { Resend } = require('resend') as {
    Resend: new (key: string) => ResendClientLike;
  };
  return new Resend(apiKey);
}

let resendClientFactory: (apiKey: string) => ResendClientLike = createDefaultResendClient;

export function setResendClientFactory(factory: (apiKey: string) => ResendClientLike): void {
  resendClientFactory = factory;
}

export function resetResendClientFactory(): void {
  resendClientFactory = createDefaultResendClient;
}

function resolveApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

function resolveSenderConfig() {
  return {
    from: process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL,
    replyTo: process.env.RESEND_REPLY_TO_EMAIL?.trim() || DEFAULT_REPLY_TO_EMAIL,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function handleEmailJob(
  payload: Record<string, unknown>,
  context: EmailJobContext = {}
): Promise<JobResult> {
  const startedAt = Date.now();
  const { to, template, template_name } = payload as unknown as EmailPayload;
  const resolvedTemplate = template_name ?? template;
  const jobId = context.jobId;

  if (!to || !resolvedTemplate) {
    logger.error('email.send.failed', {
      to,
      template: resolvedTemplate,
      job_id: jobId,
      status: 'error',
      duration: Date.now() - startedAt,
      reason: 'missing_fields',
    });
    return { success: false, error: 'Email job missing required fields: to, template_name/template' };
  }

  if (!isEmailTemplateName(resolvedTemplate)) {
    logger.error('email.send.failed', {
      to,
      template: resolvedTemplate,
      job_id: jobId,
      status: 'error',
      duration: Date.now() - startedAt,
      reason: 'unknown_template',
    });
    return { success: false, error: `Unknown email template: ${resolvedTemplate}` };
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    const missingConfigError = 'RESEND_API_KEY is required for send_email jobs';
    logger.error('email.send.failed', {
      to,
      template: resolvedTemplate,
      job_id: jobId,
      status: 'error',
      duration: Date.now() - startedAt,
      reason: 'missing_config',
    });
    return { success: false, error: missingConfigError };
  }

  const rendered = renderEmailTemplate(
    resolvedTemplate,
    ((payload.data as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
  );
  const { from, replyTo } = resolveSenderConfig();

  try {
    const client = resendClientFactory(apiKey);
    const response = await client.emails.send({
      from,
      to,
      replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    const providerError = response.error?.message;
    if (providerError) {
      logger.error('email.send.failed', {
        to,
        template: resolvedTemplate,
        job_id: jobId,
        status: 'error',
        duration: Date.now() - startedAt,
        reason: providerError,
      });
      return { success: false, error: providerError };
    }

    const emailId = response.data?.id?.trim();
    if (!emailId) {
      logger.error('email.send.failed', {
        to,
        template: resolvedTemplate,
        job_id: jobId,
        status: 'error',
        duration: Date.now() - startedAt,
        reason: 'missing_email_id',
      });
      return { success: false, error: 'Resend response missing email id' };
    }

    logger.info('email.send.completed', {
      to,
      template: resolvedTemplate,
      job_id: jobId,
      status: 'success',
      duration: Date.now() - startedAt,
    });

    return { success: true, email_id: emailId };
  } catch (error) {
    const message = toErrorMessage(error);
    logger.error('email.send.failed', {
      to,
      template: resolvedTemplate,
      job_id: jobId,
      status: 'error',
      duration: Date.now() - startedAt,
      reason: message,
    });
    return { success: false, error: message };
  }
}
