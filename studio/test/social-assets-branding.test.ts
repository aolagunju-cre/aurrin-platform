/** @jest-environment node */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_BRANDING_CONFIG,
  loadBrandingConfig,
  validateBrandingConfig,
  validateAndUpdateBrandingConfig,
} from '../src/lib/social-assets/branding';
import { generateSocialAssetPng } from '../src/lib/social-assets/generator';

async function createTempConfig(contents: string): Promise<string> {
  const baseDir = '/tmp/gh-aw/agent/branding-tests';
  await fs.mkdir(baseDir, { recursive: true });
  const dir = await fs.mkdtemp(path.join(baseDir, 'branding-config-'));
  const file = path.join(dir, 'config.json');
  await fs.writeFile(file, contents, 'utf8');
  return file;
}

describe('social assets branding config', () => {
  const previousConfigPath = process.env.SOCIAL_ASSET_CONFIG_PATH;

  afterEach(() => {
    if (previousConfigPath) {
      process.env.SOCIAL_ASSET_CONFIG_PATH = previousConfigPath;
    } else {
      delete process.env.SOCIAL_ASSET_CONFIG_PATH;
    }
  });

  it('validates required contract fields', () => {
    const result = validateBrandingConfig({
      colors: { background: '#000', foreground: '#fff' },
      logo_url: '',
      fonts: { headline: 'Inter' },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Field "logo_url" must be a non-empty string.',
        'Field "colors.accent" must be a non-empty string.',
        'Field "fonts.body" must be a non-empty string.',
      ])
    );
  });

  it('falls back to defaults when config JSON is malformed', async () => {
    const malformedPath = await createTempConfig('{bad json');
    process.env.SOCIAL_ASSET_CONFIG_PATH = malformedPath;

    const loaded = await loadBrandingConfig();

    expect(loaded.usedFallback).toBe(true);
    expect(loaded.config).toEqual(DEFAULT_BRANDING_CONFIG);
    expect(loaded.errors.length).toBeGreaterThan(0);
  });

  it('updates config and affects subsequent generation output', async () => {
    const initialPath = await createTempConfig(
      JSON.stringify({
        colors: { background: '#111111', foreground: '#eeeeee', accent: '#00aaff' },
        logo_url: 'https://example.com/logo-a.png',
        fonts: { headline: 'Inter', body: 'Inter' },
      })
    );
    process.env.SOCIAL_ASSET_CONFIG_PATH = initialPath;

    const before = await generateSocialAssetPng({
      asset_type: 'profile',
      format: 'og',
      payload: {
        founder_name: 'Sam Founder',
        company_name: 'Orbit Labs',
        score: '91.2',
        date: '2026-03-27',
        event_name: 'Spring Demo Day',
      },
    });

    const updateResult = await validateAndUpdateBrandingConfig({
      colors: { background: '#222222', foreground: '#ffffff', accent: '#ff0066' },
      logo_url: 'https://example.com/logo-b.png',
      fonts: { headline: 'Sora', body: 'Sora' },
    });
    expect(updateResult.ok).toBe(true);

    const after = await generateSocialAssetPng({
      asset_type: 'profile',
      format: 'og',
      payload: {
        founder_name: 'Sam Founder',
        company_name: 'Orbit Labs',
        score: '91.2',
        date: '2026-03-27',
        event_name: 'Spring Demo Day',
      },
    });

    expect(after.buffer.equals(before.buffer)).toBe(false);
  });
});
