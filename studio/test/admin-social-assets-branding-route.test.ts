/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GET, PATCH } from '../src/app/api/admin/social-assets/branding/route';
import { requireAdmin } from '../src/lib/auth/admin';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;

function buildRequest(url: string, method: 'GET' | 'PATCH', body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('admin social assets branding route', () => {
  const previousConfigPath = process.env.SOCIAL_ASSET_CONFIG_PATH;
  let tempConfigPath = '';

  async function createConfigFile(): Promise<string> {
    const baseDir = '/tmp/gh-aw/agent/branding-route-tests';
    await fs.mkdir(baseDir, { recursive: true });
    const dir = await fs.mkdtemp(path.join(baseDir, 'config-'));
    const file = path.join(dir, 'config.json');
    await fs.writeFile(
      file,
      JSON.stringify(
        {
          colors: { background: '#0F172A', foreground: '#F8FAFC', accent: '#22D3EE' },
          logo_url: 'https://aurrin.com/assets/logo-mark.png',
          fonts: { headline: 'Inter', body: 'Inter' },
        },
        null,
        2
      ),
      'utf8'
    );
    return file;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    tempConfigPath = await createConfigFile();
    process.env.SOCIAL_ASSET_CONFIG_PATH = tempConfigPath;

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

  afterAll(() => {
    if (previousConfigPath) {
      process.env.SOCIAL_ASSET_CONFIG_PATH = previousConfigPath;
    } else {
      delete process.env.SOCIAL_ASSET_CONFIG_PATH;
    }
  });

  it('returns 401 for unauthorized requests', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await GET(buildRequest('http://localhost/api/admin/social-assets/branding', 'GET'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Unauthorized' });
  });

  it('returns current branding config for admin users', async () => {
    const response = await GET(buildRequest('http://localhost/api/admin/social-assets/branding', 'GET'));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.branding_config).toEqual(
      expect.objectContaining({
        colors: expect.any(Object),
        logo_url: expect.any(String),
        fonts: expect.any(Object),
      })
    );
  });

  it('rejects invalid branding payloads', async () => {
    const response = await PATCH(
      buildRequest('http://localhost/api/admin/social-assets/branding', 'PATCH', {
        logo_url: '',
        colors: { accent: '' },
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        message: 'Invalid branding config.',
      })
    );
    expect(payload.errors).toEqual(expect.arrayContaining([expect.stringContaining('logo_url')]));
  });

  it('updates branding config for valid admin patch payload', async () => {
    const response = await PATCH(
      buildRequest('http://localhost/api/admin/social-assets/branding', 'PATCH', {
        colors: { accent: '#ff0055' },
        fonts: { body: 'Sora' },
        logo_url: 'https://example.com/new-logo.png',
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.branding_config.logo_url).toBe('https://example.com/new-logo.png');
    expect(payload.data.branding_config.colors.accent).toBe('#ff0055');
    expect(payload.data.branding_config.fonts.body).toBe('Sora');
  });
});
