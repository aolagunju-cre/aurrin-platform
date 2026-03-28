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

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

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
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.FORCE_DEMO_MODE;
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    resetRuntimeEnvCacheForTests();
    global.fetch = jest.fn();
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
});
