import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/admin';
import { enqueueJob } from '../../../../lib/jobs/enqueue';
import { parseSocialAssetFormat, parseSocialAssetType } from '../../../../lib/social-assets/types';

function parseRequiredId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const assetType = parseSocialAssetType(body.asset_type);
  const founderId = parseRequiredId(body.founder_id);
  const eventId = parseRequiredId(body.event_id);
  const format = parseSocialAssetFormat(body.format);

  if (!assetType || !founderId || !eventId || !format) {
    return NextResponse.json(
      {
        success: false,
        message: 'Request body must include asset_type (profile|highlight|event), founder_id, event_id, and format (twitter|linkedin|og).',
      },
      { status: 400 }
    );
  }

  const job = await enqueueJob(
    'generate_social_asset',
    {
      asset_type: assetType,
      founder_id: founderId,
      event_id: eventId,
      format,
    },
    {
      aggregate_id: `${assetType}:${founderId}:${eventId}:${format}`,
      aggregate_type: 'social_asset',
    }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        job_id: job.id,
      },
    },
    { status: 202 }
  );
}
