import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import {
  type BrandingConfig,
  loadBrandingConfig,
  validateAndUpdateBrandingConfig,
  validateBrandingConfig,
} from '../../../../../lib/social-assets/branding';

function mergeBrandingConfig(base: BrandingConfig, patch: unknown): unknown {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    return patch;
  }

  const patchRecord = patch as Record<string, unknown>;
  const colorsPatch = patchRecord.colors;
  const fontsPatch = patchRecord.fonts;

  return {
    ...base,
    ...patchRecord,
    colors:
      typeof colorsPatch === 'object' && colorsPatch !== null && !Array.isArray(colorsPatch)
        ? { ...base.colors, ...(colorsPatch as Record<string, unknown>) }
        : base.colors,
    fonts:
      typeof fontsPatch === 'object' && fontsPatch !== null && !Array.isArray(fontsPatch)
        ? { ...base.fonts, ...(fontsPatch as Record<string, unknown>) }
        : base.fonts,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const branding = await loadBrandingConfig();

  return NextResponse.json(
    {
      success: true,
      data: {
        branding_config: branding.config,
        used_fallback: branding.usedFallback,
        validation_errors: branding.errors,
      },
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Request body must be valid JSON.',
      },
      { status: 400 }
    );
  }

  const current = await loadBrandingConfig();
  const merged = mergeBrandingConfig(current.config, body);
  const validation = validateBrandingConfig(merged);
  if (!validation.ok) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid branding config.',
        errors: validation.errors,
      },
      { status: 400 }
    );
  }

  try {
    const writeResult = await validateAndUpdateBrandingConfig(merged);
    if (!writeResult.ok || !writeResult.config) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid branding config.',
          errors: writeResult.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          branding_config: writeResult.config,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update branding config.',
      },
      { status: 500 }
    );
  }
}
