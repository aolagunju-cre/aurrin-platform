import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../lib/db/client';
import { parseSocialAssetFormat, parseSocialAssetType } from '../../../../../lib/social-assets/types';
import { loadSignedAssetMetadataByStoragePath } from '../../../../../lib/social-assets/delivery';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

interface SocialAssetJobRow {
  id: string;
  state: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  payload: Record<string, unknown> | null;
  error_message: string | null;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface SocialAssetPayload {
  asset_type: 'profile' | 'highlight' | 'event';
  founder_id: string;
  event_id: string;
  format: 'twitter' | 'linkedin' | 'og';
}

function parsePayload(payload: Record<string, unknown> | null): SocialAssetPayload | null {
  if (!payload) {
    return null;
  }

  const assetType = parseSocialAssetType(payload.asset_type);
  const format = parseSocialAssetFormat(payload.format);
  const founderId = typeof payload.founder_id === 'string' && payload.founder_id.trim().length > 0 ? payload.founder_id.trim() : null;
  const eventId = typeof payload.event_id === 'string' && payload.event_id.trim().length > 0 ? payload.event_id.trim() : null;

  if (!assetType || !format || !founderId || !eventId) {
    return null;
  }

  return {
    asset_type: assetType,
    founder_id: founderId,
    event_id: eventId,
    format,
  };
}

function statusFromState(state: SocialAssetJobRow['state']): 'pending' | 'processing' | 'completed' | 'failed' {
  if (state === 'dead_letter') {
    return 'failed';
  }
  return state;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { jobId } = await params;
  const client = getSupabaseClient();

  const jobResult = await client.db.queryTable<SocialAssetJobRow>(
    'outbox_jobs',
    `id=eq.${encodeURIComponent(jobId)}&job_type=in.(generate_social_asset,social_asset)&select=id,state,payload,error_message,last_error,created_at,completed_at&limit=1`
  );
  if (jobResult.error) {
    return NextResponse.json({ success: false, message: jobResult.error.message }, { status: 500 });
  }

  const job = jobResult.data[0] ?? null;
  if (!job) {
    return NextResponse.json({ success: false, message: 'Social asset job not found.' }, { status: 404 });
  }

  const payload = parsePayload(job.payload);
  if (!payload) {
    return NextResponse.json({ success: false, message: 'Social asset job payload is invalid.' }, { status: 500 });
  }

  let asset = null;
  if (job.state === 'completed') {
    const storagePath = `social-assets/${payload.asset_type}/${payload.founder_id}/${payload.event_id}/${payload.format}.png`;
    asset = await loadSignedAssetMetadataByStoragePath(storagePath);
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        job_id: job.id,
        status: statusFromState(job.state),
        asset_type: payload.asset_type,
        founder_id: payload.founder_id,
        event_id: payload.event_id,
        format: payload.format,
        created_at: job.created_at,
        completed_at: job.completed_at,
        asset,
        error: job.error_message ?? job.last_error,
      },
    },
    { status: 200 }
  );
}
