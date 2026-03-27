/** @jest-environment node */

import { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, DEMO_SESSION_COOKIE } from '../src/lib/auth/request-auth';

describe('auth sign-out route', () => {
  it('uses a GET-safe redirect after POST sign-out', async () => {
    const { POST } = await import('../src/app/auth/sign-out/route');

    const response = await POST(
      new NextRequest(
        new Request('http://localhost/auth/sign-out?next=%2Fauth%2Fsign-in', {
          method: 'POST',
        })
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/auth/sign-in');
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)?.value).toBe('');
    expect(response.cookies.get(DEMO_SESSION_COOKIE)?.value).toBe('');
  });
});
