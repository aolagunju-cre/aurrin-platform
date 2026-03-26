/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../src/app/api/admin/emails/preview/route';
import { requireAdmin } from '../src/lib/auth/admin';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;

function buildRequest(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}

describe('admin email preview route', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedRequireAdmin.mockResolvedValue({
      userId: 'admin-1',
      auth: {
        sub: 'admin-1',
        email: 'admin@example.com',
        iat: 0,
        exp: 9999999999,
        aud: 'authenticated',
        iss: 'https://example.supabase.co/auth/v1',
      },
    });
  });

  it('returns 401 for unauthorized requests', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await GET(
      buildRequest('http://localhost/api/admin/emails/preview?template=welcome_founder&data=%7B%7D')
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Unauthorized' });
  });

  it('returns rendered HTML for supported templates', async () => {
    const response = await GET(
      buildRequest(
        `http://localhost/api/admin/emails/preview?template=welcome_founder&data=${encodeURIComponent(
          JSON.stringify({
            name: 'Jane Founder',
            company: 'Orbit Labs',
            link: 'https://example.com/portal',
            date: '2026-03-26',
          })
        )}`
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('Jane Founder');
    expect(html).toContain('Orbit Labs');
    expect(html).toContain('https://example.com/portal');
  });

  it('returns 404 for unknown template names', async () => {
    const response = await GET(
      buildRequest('http://localhost/api/admin/emails/preview?template=unknown_template&data=%7B%7D')
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Unknown email template: unknown_template',
    });
  });

  it('returns 400 for malformed data payload', async () => {
    const response = await GET(
      buildRequest('http://localhost/api/admin/emails/preview?template=welcome_founder&data=%7Bbad-json')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Query parameter "data" must be valid JSON.',
    });
  });
});
