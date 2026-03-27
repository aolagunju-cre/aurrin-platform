/** @jest-environment node */

import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

describe('middleware public path guard', () => {
  it('allows /api/public/validate routes without authorization header', async () => {
    const request = new NextRequest(new Request('http://localhost/api/public/validate/event-1/session', { method: 'POST' }));
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});
