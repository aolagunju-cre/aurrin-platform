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
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
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

  it('redirects token sign-in submissions with a GET-safe status', async () => {
    const { POST } = await import('../src/app/auth/sign-in/submit/route');

    const formData = new FormData();
    formData.set('mode', 'token');
    formData.set('access_token', 'valid-token');
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
    expect(response.headers.get('location')).toBe('http://localhost/admin');
  });
});
