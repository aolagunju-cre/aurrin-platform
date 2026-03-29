/** @jest-environment node */

import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';
import { upsertPlatformWaitlistSignup } from '../src/lib/waitlist/db';

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

describe('waitlist db helper', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    resetRuntimeEnvCacheForTests();

    global.fetch = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));

      return {
        ok: true,
        status: 201,
        statusText: 'Created',
        json: async () => [{
          id: 'signup-1',
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          phone: body.phone,
          source: body.source,
          metadata: body.metadata,
          created_at: '2026-03-29T00:00:00.000Z',
          updated_at: '2026-03-29T00:00:00.000Z',
        }],
      };
    }) as typeof fetch;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
    resetRuntimeEnvCacheForTests();
  });

  it('upserts signups through the Supabase REST endpoint using email conflict resolution', async () => {
    const result = await upsertPlatformWaitlistSignup({
      first_name: 'Jordan',
      last_name: 'Lee',
      email: 'Jordan@Example.com',
      phone: '(403) 555-0123',
      source: 'public-waitlist',
      metadata: { sourceRoute: 'waitlist' },
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body));
    const headers = init.headers as Record<string, string>;

    expect(url).toBe(
      'https://example.supabase.co/rest/v1/platform_waitlist_signups?on_conflict=email'
    );
    expect(init.method).toBe('POST');
    expect(headers.Prefer).toBe('resolution=merge-duplicates,return=representation');
    expect(body).toEqual({
      first_name: 'Jordan',
      last_name: 'Lee',
      email: 'jordan@example.com',
      phone: '(403) 555-0123',
      source: 'public-waitlist',
      metadata: { sourceRoute: 'waitlist' },
    });
    expect(result.data?.email).toBe('jordan@example.com');
    expect(result.error).toBeNull();
  });
});
