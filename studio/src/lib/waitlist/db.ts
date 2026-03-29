import { getRuntimeEnv } from '../config/env';
import type {
  PlatformWaitlistSignupRecord,
  PlatformWaitlistSignupUpsert,
} from './types';

function getBaseUrl(): string {
  const env = getRuntimeEnv();
  return env.supabaseUrl ?? '';
}

function getHeaders(prefer = 'return=representation'): Record<string, string> {
  const env = getRuntimeEnv();
  const key = env.supabaseServiceRoleKey ?? '';

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

function missingConfigError(): Error {
  return new Error(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)'
  );
}

export async function upsertPlatformWaitlistSignup(
  record: PlatformWaitlistSignupUpsert
): Promise<{ data: PlatformWaitlistSignupRecord | null; error: Error | null }> {
  const env = getRuntimeEnv();

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { data: null, error: missingConfigError() };
  }

  try {
    const url = `${getBaseUrl()}/rest/v1/platform_waitlist_signups?on_conflict=email`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders('resolution=merge-duplicates,return=representation'),
      body: JSON.stringify({
        first_name: record.first_name,
        last_name: record.last_name,
        email: record.email.toLowerCase(),
        phone: record.phone,
        source: record.source ?? 'public-waitlist',
        metadata: record.metadata ?? {},
      }),
    });

    if (!response.ok) {
      return {
        data: null,
        error: new Error(`Waitlist upsert failed: ${response.status} ${response.statusText}`),
      };
    }

    const rows = await response.json() as PlatformWaitlistSignupRecord[];

    return { data: rows[0] ?? null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
