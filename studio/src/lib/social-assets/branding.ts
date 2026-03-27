import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import brandingDefaultsJson from './config.json';

export interface BrandingColors {
  background: string;
  foreground: string;
  accent: string;
}

export interface BrandingFonts {
  headline: string;
  body: string;
}

export interface BrandingConfig {
  colors: BrandingColors;
  logo_url: string;
  fonts: BrandingFonts;
}

export interface BrandingValidationResult {
  ok: boolean;
  errors: string[];
  config?: BrandingConfig;
}

export interface BrandingLoadResult {
  config: BrandingConfig;
  usedFallback: boolean;
  errors: string[];
  sourcePath: string;
}

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  colors: {
    background: brandingDefaultsJson.colors.background,
    foreground: brandingDefaultsJson.colors.foreground,
    accent: brandingDefaultsJson.colors.accent,
  },
  logo_url: brandingDefaultsJson.logo_url,
  fonts: {
    headline: brandingDefaultsJson.fonts.headline,
    body: brandingDefaultsJson.fonts.body,
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredNonEmptyString(value: unknown, fieldName: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`Field "${fieldName}" must be a non-empty string.`);
    return null;
  }
  return value.trim();
}

export function validateBrandingConfig(input: unknown): BrandingValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Branding config must be a JSON object.'] };
  }

  const colorsRaw = input.colors;
  const fontsRaw = input.fonts;

  if (!isObject(colorsRaw)) {
    errors.push('Field "colors" must be an object.');
  }

  if (!isObject(fontsRaw)) {
    errors.push('Field "fonts" must be an object.');
  }

  const logoUrl = requiredNonEmptyString(input.logo_url, 'logo_url', errors);

  const background = isObject(colorsRaw)
    ? requiredNonEmptyString(colorsRaw.background, 'colors.background', errors)
    : null;
  const foreground = isObject(colorsRaw)
    ? requiredNonEmptyString(colorsRaw.foreground, 'colors.foreground', errors)
    : null;
  const accent = isObject(colorsRaw)
    ? requiredNonEmptyString(colorsRaw.accent, 'colors.accent', errors)
    : null;

  const headline = isObject(fontsRaw)
    ? requiredNonEmptyString(fontsRaw.headline, 'fonts.headline', errors)
    : null;
  const body = isObject(fontsRaw)
    ? requiredNonEmptyString(fontsRaw.body, 'fonts.body', errors)
    : null;

  if (errors.length > 0 || !logoUrl || !background || !foreground || !accent || !headline || !body) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors,
    config: {
      colors: { background, foreground, accent },
      logo_url: logoUrl,
      fonts: { headline, body },
    },
  };
}

function resolveBrandingConfigPath(): string {
  const configuredPath = process.env.SOCIAL_ASSET_CONFIG_PATH;
  const candidates = [
    configuredPath,
    path.resolve(process.cwd(), 'src/lib/social-assets/config.json'),
    path.resolve(process.cwd(), 'studio/src/lib/social-assets/config.json'),
    path.resolve(__dirname, 'config.json'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? path.resolve(process.cwd(), 'src/lib/social-assets/config.json');
}

export async function loadBrandingConfig(): Promise<BrandingLoadResult> {
  const configPath = resolveBrandingConfigPath();

  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const validation = validateBrandingConfig(parsed);
    if (validation.ok && validation.config) {
      return {
        config: validation.config,
        usedFallback: false,
        errors: [],
        sourcePath: configPath,
      };
    }

    return {
      config: DEFAULT_BRANDING_CONFIG,
      usedFallback: true,
      errors: validation.errors,
      sourcePath: configPath,
    };
  } catch (error) {
    return {
      config: DEFAULT_BRANDING_CONFIG,
      usedFallback: true,
      errors: [error instanceof Error ? error.message : 'Failed to load branding config.'],
      sourcePath: configPath,
    };
  }
}

export async function updateBrandingConfig(nextConfig: BrandingConfig): Promise<void> {
  const configPath = resolveBrandingConfigPath();
  const contents = `${JSON.stringify(nextConfig, null, 2)}\n`;
  await fsp.writeFile(configPath, contents, 'utf8');
}

export async function validateAndUpdateBrandingConfig(input: unknown): Promise<BrandingValidationResult> {
  const validation = validateBrandingConfig(input);
  if (!validation.ok || !validation.config) {
    return validation;
  }

  await updateBrandingConfig(validation.config);
  return validation;
}
