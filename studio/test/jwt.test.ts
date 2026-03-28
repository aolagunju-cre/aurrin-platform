/** @jest-environment node */

import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';
import { verifyJWT } from '../src/lib/auth/jwt';

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

describe('jwt verification fallback', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.SUPABASE_JWT_SECRET;
    resetRuntimeEnvCacheForTests();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user-123',
        email: 'user@example.com',
        email_confirmed_at: '2026-03-28T00:00:00.000Z',
        app_metadata: { provider: 'email' },
        user_metadata: { name: 'Founder User' },
      }),
    }) as typeof fetch;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
    resetRuntimeEnvCacheForTests();
  });

  it('introspects Supabase access tokens when the local jwt secret is unavailable', async () => {
    const token = [
      'header',
      Buffer.from(JSON.stringify({
        aud: 'authenticated',
        exp: 2000000000,
        iat: 1000000000,
        iss: 'https://example.supabase.co/auth/v1',
      })).toString('base64url'),
      'signature',
    ].join('.');

    await expect(verifyJWT(token)).resolves.toEqual({
      sub: 'user-123',
      email: 'user@example.com',
      email_confirmed_at: '2026-03-28T00:00:00.000Z',
      phone_confirmed_at: undefined,
      app_metadata: { provider: 'email' },
      user_metadata: { name: 'Founder User' },
      iat: 1000000000,
      exp: 2000000000,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/user',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });
});
