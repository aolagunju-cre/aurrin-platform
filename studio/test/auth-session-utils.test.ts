/** @jest-environment node */

import { getCurrentUser, resetSessionContext } from '../src/lib/auth/session';
import { cookies, headers } from 'next/headers';
import { verifyJWT } from '../src/lib/auth/jwt';
import { getSupabaseClient } from '../src/lib/db/client';
import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';

jest.mock('next/headers', () => ({
  headers: jest.fn(),
  cookies: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  verifyJWT: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedHeaders = headers as jest.MockedFunction<typeof headers>;
const mockedCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

describe('auth session utilities', () => {
  beforeEach(() => {
    resetSessionContext();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_JWT_SECRET;
    process.env.DEMO_MODE = 'true';
    global.fetch = jest.fn();
    resetRuntimeEnvCacheForTests();
    mockedCookies.mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    mockedGetSupabaseClient.mockReturnValue({
      db: {
        getRoleAssignmentsByUserId: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as never,
      storage: {} as never,
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
    resetRuntimeEnvCacheForTests();
  });

  it('returns current user payload when token is valid', async () => {
    mockedHeaders.mockResolvedValueOnce(
      new Headers({
        authorization: 'Bearer valid-token',
      }) as unknown as Awaited<ReturnType<typeof headers>>
    );
    mockedVerifyJWT.mockResolvedValueOnce({
      sub: 'user-123',
      email: 'user@example.com',
      email_confirmed_at: '2026-03-27T00:00:00.000Z',
      iat: 1,
      exp: 2,
      aud: 'authenticated',
      iss: 'https://example.test/auth/v1',
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'user-123',
      email: 'user@example.com',
      emailConfirmed: true,
      roleAssignments: [],
    });
  });

  it('rejects invalid token payload and returns null', async () => {
    mockedHeaders.mockResolvedValueOnce(
      new Headers({
        authorization: 'Bearer invalid-token',
      }) as unknown as Awaited<ReturnType<typeof headers>>
    );
    mockedVerifyJWT.mockResolvedValueOnce(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('rejects stale Supabase sessions when non-demo mode is configured', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    mockedHeaders.mockResolvedValueOnce(
      new Headers({
        authorization: 'Bearer stale-token',
      }) as unknown as Awaited<ReturnType<typeof headers>>
    );
    mockedVerifyJWT.mockResolvedValueOnce({
      sub: 'user-123',
      email: 'user@example.com',
      iat: 1,
      exp: 2,
      aud: 'authenticated',
      iss: 'https://example.test/auth/v1',
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/user',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });
});
