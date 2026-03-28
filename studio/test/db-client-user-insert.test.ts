/** @jest-environment node */

import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';
import { getSupabaseClient, resetSupabaseClient } from '../src/lib/db/client';

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

describe('db client user inserts', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    resetRuntimeEnvCacheForTests();
    resetSupabaseClient();

    global.fetch = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      return {
        ok: true,
        json: async () => [{
          id: body.id,
          email: body.email,
          name: body.name,
          avatar_url: null,
          unsubscribed: body.unsubscribed,
          unsubscribe_token: body.unsubscribe_token,
          created_at: '2026-03-28T00:00:00.000Z',
          updated_at: '2026-03-28T00:00:00.000Z',
        }],
      };
    }) as typeof fetch;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
    resetRuntimeEnvCacheForTests();
    resetSupabaseClient();
  });

  it('fills unsubscribe defaults required by the live users schema', async () => {
    const result = await getSupabaseClient().db.insertUser({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'new-founder@example.com',
      name: 'New Founder',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(body).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'new-founder@example.com',
      name: 'New Founder',
      unsubscribed: false,
    });
    expect(body.unsubscribe_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(result.data?.unsubscribe_token).toBe(body.unsubscribe_token);
  });
});
