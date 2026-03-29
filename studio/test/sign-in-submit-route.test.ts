/** @jest-environment node */

import { NextRequest } from 'next/server';
import { DEMO_SESSION_COOKIE } from '../src/lib/auth/request-auth';
import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';

jest.mock('../src/lib/auth/jwt', () => ({
  verifyJWT: jest.fn().mockResolvedValue({
    sub: 'user-123',
    email: 'admin@aurrin.demo',
  }),
}));

jest.mock('../src/lib/auth/request-auth', () => {
  const actual = jest.requireActual('../src/lib/auth/request-auth');
  return {
    ...actual,
    createDemoSessionToken: jest.fn().mockResolvedValue('demo-session-token'),
    setAccessTokenCookie: jest.fn(),
  };
});

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

function getVerifyJWTMock(): jest.Mock {
  return (jest.requireMock('../src/lib/auth/jwt') as { verifyJWT: jest.Mock }).verifyJWT;
}

function getSupabaseClientMock(): jest.Mock {
  return (jest.requireMock('../src/lib/db/client') as { getSupabaseClient: jest.Mock }).getSupabaseClient;
}

function configureRoleAssignmentsMock(
  assignments: Array<{ role: string; scope: string; scoped_id: string | null }>,
  overrides: Partial<Record<string, jest.Mock>> = {}
) {
  getSupabaseClientMock().mockReturnValue({
    db: {
      getRoleAssignmentsByUserId: jest.fn().mockResolvedValue({
        data: assignments,
        error: null,
      }),
      ...overrides,
    },
    storage: {},
  } as never);
}

function buildDemoRequest(nextPath = '/mentor'): NextRequest {
  const formData = new FormData();
  formData.set('mode', 'demo');
  formData.set('persona', 'mentor');
  formData.set('next', nextPath);

  return new NextRequest(
    new Request('http://localhost/auth/sign-in/submit', {
      method: 'POST',
      body: formData,
    })
  );
}

describe('auth sign-in submit route', () => {
  beforeEach(() => {
    jest.resetModules();
    getVerifyJWTMock().mockResolvedValue({
      sub: 'user-123',
      email: 'admin@aurrin.demo',
    } as never);
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.FORCE_DEMO_MODE;
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    resetRuntimeEnvCacheForTests();
    global.fetch = jest.fn();
    configureRoleAssignmentsMock([{ role: 'admin', scope: 'global', scoped_id: null }]);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
    resetRuntimeEnvCacheForTests();
  });

  it('creates a demo session in production when DEMO_MODE=true', async () => {
    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const response = await POST(buildDemoRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/mentor');
    expect(response.cookies.get(DEMO_SESSION_COOKIE)?.value).toEqual(expect.any(String));
  });

  it('redirects invalid demo persona submissions back to sign-in with a GET-safe status', async () => {
    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'demo');
    formData.set('persona', 'invalid-persona');
    formData.set('next', '/founder');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/auth/sign-in?next=%2Ffounder&error=forbidden');
  });

  it('authenticates email/password submissions against Supabase in non-demo mode', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    resetRuntimeEnvCacheForTests();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'valid-token' }),
    });

    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'credentials');
    formData.set('email', 'owner@example.com');
    formData.set('password', 'super-secret-password');
    formData.set('next', '/admin');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/token?grant_type=password',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/admin');
  });

  it('redirects failed email/password submissions back to sign-in with deterministic error state', async () => {
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

    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'credentials');
    formData.set('email', 'owner@example.com');
    formData.set('password', 'wrong-password');
    formData.set('next', '/admin');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/auth/sign-in?next=%2Fadmin&error=invalid_credentials');
  });

  it('routes credential sign-in users to the role-based default portal when next is root', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'valid-token' }),
    });
    configureRoleAssignmentsMock([{ role: 'founder', scope: 'global', scoped_id: null }]);

    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'credentials');
    formData.set('email', 'founder@example.com');
    formData.set('password', 'valid-password');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/founder');
  });

  it('uses deterministic role precedence for multi-role users when next is root', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'valid-token' }),
    });
    configureRoleAssignmentsMock([
      { role: 'subscriber', scope: 'global', scoped_id: null },
      { role: 'judge', scope: 'event', scoped_id: 'event-1' },
    ]);

    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'credentials');
    formData.set('email', 'judge@example.com');
    formData.set('password', 'valid-password');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/judge/events');
  });

  it('redirects with explicit env-config error when Supabase auth keys are missing', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    resetRuntimeEnvCacheForTests();

    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'credentials');
    formData.set('email', 'owner@example.com');
    formData.set('password', 'super-secret-password');
    formData.set('next', '/admin');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/auth/sign-in?next=%2Fadmin&error=supabase_not_configured');
  });

  it('self-heals orphaned safe-role users on credential sign-in', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    getVerifyJWTMock().mockResolvedValue({
      sub: 'user-123',
      email: 'founder@example.com',
      user_metadata: {
        name: 'Recovered Founder',
        role: 'founder',
      },
    } as never);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'valid-token' }),
    });

    const mockDb = {
      getRoleAssignmentsByUserId: jest.fn()
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'ra-1',
              user_id: 'user-123',
              role: 'founder',
              scope: 'global',
              scoped_id: null,
            },
          ],
          error: null,
        }),
      getUserByEmail: jest.fn().mockResolvedValue({ data: null, error: null }),
      insertUser: jest.fn().mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'founder@example.com',
          name: 'Recovered Founder',
        },
        error: null,
      }),
      updateUser: jest.fn().mockResolvedValue({ data: null, error: null }),
      insertRoleAssignment: jest.fn().mockResolvedValue({
        data: {
          id: 'ra-1',
          user_id: 'user-123',
          role: 'founder',
          scope: 'global',
          scoped_id: null,
        },
        error: null,
      }),
    };

    getSupabaseClientMock().mockReturnValue({
      db: mockDb,
      storage: {},
    } as never);

    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'credentials');
    formData.set('email', 'founder@example.com');
    formData.set('password', 'valid-password');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(mockDb.getUserByEmail).toHaveBeenCalledWith('founder@example.com');
    expect(mockDb.insertUser).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'founder@example.com',
      name: 'Recovered Founder',
    });
    expect(mockDb.insertRoleAssignment).toHaveBeenCalledWith({
      user_id: 'user-123',
      role: 'founder',
      scope: 'global',
      scoped_id: null,
      created_by: 'user-123',
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/founder');
  });

  it('refuses to self-assign unsafe roles from auth metadata', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    getVerifyJWTMock().mockResolvedValue({
      sub: 'user-123',
      email: 'owner@example.com',
      user_metadata: {
        role: 'admin',
      },
    } as never);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'valid-token' }),
    });

    configureRoleAssignmentsMock([]);

    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'credentials');
    formData.set('email', 'owner@example.com');
    formData.set('password', 'valid-password');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-in/submit', {
          method: 'POST',
          body: formData,
        })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/auth/sign-in?next=%2F&error=forbidden');
  });
});
