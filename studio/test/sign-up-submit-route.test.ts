/** @jest-environment node */

import { NextRequest } from 'next/server';
import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';
import { getSupabaseClient } from '../src/lib/db/client';
import { setAccessTokenCookie, setDemoSessionCookie } from '../src/lib/auth/request-auth';

jest.mock('../src/lib/auth/jwt', () => ({
  verifyJWT: jest.fn().mockResolvedValue({
    sub: 'user-123',
    email: 'new-founder@example.com',
  }),
}));

jest.mock('../src/lib/auth/request-auth', () => {
  const actual = jest.requireActual('../src/lib/auth/request-auth');
  return {
    ...actual,
    createDemoRegistrationSessionToken: jest.fn().mockResolvedValue('demo-sign-up-token'),
    setAccessTokenCookie: jest.fn(),
    setDemoSessionCookie: jest.fn(),
  };
});

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedSetAccessTokenCookie = setAccessTokenCookie as jest.MockedFunction<typeof setAccessTokenCookie>;
const mockedSetDemoSessionCookie = setDemoSessionCookie as jest.MockedFunction<typeof setDemoSessionCookie>;

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

function buildRequest(fields: Record<string, string>): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return new NextRequest(
    new Request('http://localhost/auth/sign-up/submit', {
      method: 'POST',
      body: formData,
    })
  );
}

describe('auth sign-up submit route', () => {
  beforeEach(() => {
    mockedGetSupabaseClient.mockReset();
    mockedSetAccessTokenCookie.mockReset();
    mockedSetDemoSessionCookie.mockReset();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.FORCE_DEMO_MODE;
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'false';
    resetRuntimeEnvCacheForTests();
    global.fetch = jest.fn();
    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        getUserByEmail: jest.fn(),
        insertUser: jest.fn(),
        updateUser: jest.fn(),
        getRoleAssignmentsByUserId: jest.fn(),
        insertRoleAssignment: jest.fn(),
      } as never,
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
    resetRuntimeEnvCacheForTests();
  });

  it('creates users and initial role assignment in non-demo mode', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    const mockDb = {
      getUserByEmail: jest.fn().mockResolvedValue({ data: null, error: null }),
      insertUser: jest.fn().mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'new-founder@example.com',
          name: 'New Founder',
          avatar_url: null,
          unsubscribed: false,
          unsubscribe_token: null,
          created_at: '2026-03-28T00:00:00.000Z',
          updated_at: '2026-03-28T00:00:00.000Z',
        },
        error: null,
      }),
      updateUser: jest.fn(),
      getRoleAssignmentsByUserId: jest.fn().mockResolvedValue({ data: [], error: null }),
      insertRoleAssignment: jest.fn().mockResolvedValue({
        data: {
          id: 'ra-1',
          user_id: 'user-123',
          role: 'founder',
          scope: 'global',
          scoped_id: null,
          created_at: '2026-03-28T00:00:00.000Z',
          updated_at: '2026-03-28T00:00:00.000Z',
          created_by: 'user-123',
        },
        error: null,
      }),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        user: {
          id: 'user-123',
          email: 'new-founder@example.com',
        },
      }),
    });

    const { POST } = await import('../src/app/auth/sign-up/submit/route');

    const response = await POST(buildRequest({
      mode: 'credentials',
      name: 'New Founder',
      email: 'new-founder@example.com',
      password: 'VeryStrongPass123!',
      role: 'Founder',
    }));

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/signup',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockDb.insertUser).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'new-founder@example.com',
      name: 'New Founder',
    });
    expect(mockDb.insertRoleAssignment).toHaveBeenCalledWith({
      user_id: 'user-123',
      role: 'founder',
      scope: 'global',
      scoped_id: null,
      created_by: 'user-123',
    });
    expect(mockedSetAccessTokenCookie).toHaveBeenCalledWith(expect.any(Object), 'access-token');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/founder');
  });

  it('rejects admin self-assignment attempts', async () => {
    const { POST } = await import('../src/app/auth/sign-up/submit/route');

    const response = await POST(buildRequest({
      mode: 'credentials',
      email: 'owner@example.com',
      password: 'irrelevant',
      role: 'admin',
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/auth/sign-up?next=%2F&error=invalid_role');
  });

  it('creates a demo session from sign-up form input when demo mode is enabled', async () => {
    process.env.DEMO_MODE = 'true';
    resetRuntimeEnvCacheForTests();

    const { POST } = await import('../src/app/auth/sign-up/submit/route');

    const response = await POST(buildRequest({
      mode: 'demo',
      name: 'Demo Mentor',
      email: 'mentor@example.com',
      password: 'irrelevant',
      role: 'mentor',
    }));

    expect(mockedSetDemoSessionCookie).toHaveBeenCalledWith(expect.any(Object), 'demo-sign-up-token');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/mentor');
  });
});
