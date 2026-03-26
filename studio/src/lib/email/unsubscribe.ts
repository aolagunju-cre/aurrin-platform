import { randomUUID } from 'crypto';
import { getSupabaseClient } from '../db/client';
import type { EmailTemplateName } from './templates';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRANSACTIONAL_TEMPLATES = new Set<EmailTemplateName>(['password_reset', 'email_verification']);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isTransactionalTemplate(templateName: EmailTemplateName): boolean {
  return TRANSACTIONAL_TEMPLATES.has(templateName);
}

export function resolveUnsubscribeBaseUrl(): string {
  const candidates = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value.replace(/\/+$/, '');
    }
  }

  return '{baseUrl}';
}

export async function getRecipientUnsubscribeState(email: string): Promise<{
  recipientEmail: string;
  unsubscribed: boolean;
  unsubscribeToken: string;
}> {
  const recipientEmail = normalizeEmail(email);
  const client = getSupabaseClient();
  const userResult = await client.db.getUserByEmail(recipientEmail);
  if (userResult.error) {
    throw new Error(`Could not load unsubscribe state: ${userResult.error.message}`);
  }

  const user = userResult.data;
  if (!user) {
    return {
      recipientEmail,
      unsubscribed: false,
      unsubscribeToken: '{uuid}',
    };
  }

  if (user.unsubscribed) {
    return {
      recipientEmail: normalizeEmail(user.email),
      unsubscribed: true,
      unsubscribeToken: user.unsubscribe_token ?? '{uuid}',
    };
  }

  if (user.unsubscribe_token) {
    return {
      recipientEmail: normalizeEmail(user.email),
      unsubscribed: false,
      unsubscribeToken: user.unsubscribe_token,
    };
  }

  const generatedToken = randomUUID();
  const updateResult = await client.db.updateUser(user.id, { unsubscribe_token: generatedToken });
  if (updateResult.error || !updateResult.data) {
    throw new Error(`Could not persist unsubscribe token: ${updateResult.error?.message ?? 'unknown error'}`);
  }

  return {
    recipientEmail: normalizeEmail(updateResult.data.email),
    unsubscribed: false,
    unsubscribeToken: updateResult.data.unsubscribe_token ?? generatedToken,
  };
}

export function isValidUnsubscribeToken(token: string): boolean {
  return UUID_REGEX.test(token.trim());
}

export async function verifyAndApplyUnsubscribe(token: string, email: string): Promise<boolean> {
  const normalizedToken = token.trim();
  const normalizedEmail = normalizeEmail(email);
  if (!isValidUnsubscribeToken(normalizedToken) || !normalizedEmail) {
    return false;
  }

  const client = getSupabaseClient();
  const userResult = await client.db.getUserByEmail(normalizedEmail);
  if (userResult.error || !userResult.data) {
    return false;
  }

  if (userResult.data.unsubscribe_token !== normalizedToken) {
    return false;
  }

  const updateResult = await client.db.updateUser(userResult.data.id, { unsubscribed: true });
  return !updateResult.error;
}
