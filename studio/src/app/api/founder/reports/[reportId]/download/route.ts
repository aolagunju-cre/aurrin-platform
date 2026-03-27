import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { canAccessFounderEvent, requireFounderOrAdmin } from '../../../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../../../lib/db/client';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

interface RouteParams {
  params: Promise<{ reportId: string }>;
}

interface ReportJobRow {
  id: string;
  payload: Record<string, unknown> | null;
  state: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
}

interface ReportPayload {
  founder_id: string;
  event_id: string;
  pitch_id: string;
  report_type: 'full' | 'summary';
}

interface FileRow {
  id: string;
  owner_id: string;
  storage_path: string;
  signed_url_expiry: number | null;
}

function parseReportPayload(payload: Record<string, unknown> | null): ReportPayload | null {
  if (!payload) {
    return null;
  }

  const founderId = payload.founder_id;
  const eventId = payload.event_id;
  const pitchId = payload.pitch_id;
  const reportType = payload.report_type;

  if (typeof founderId !== 'string' || typeof eventId !== 'string' || typeof pitchId !== 'string') {
    return null;
  }
  if (reportType !== 'full' && reportType !== 'summary') {
    return null;
  }

  return {
    founder_id: founderId,
    event_id: eventId,
    pitch_id: pitchId,
    report_type: reportType,
  };
}

function splitStoragePath(storagePath: string): { bucket: string; relativePath: string } | null {
  const firstSlash = storagePath.indexOf('/');
  if (firstSlash <= 0 || firstSlash === storagePath.length - 1) {
    return null;
  }

  return {
    bucket: storagePath.slice(0, firstSlash),
    relativePath: storagePath.slice(firstSlash + 1),
  };
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (DEMO_MODE) {
    const { reportId } = await params;
    return NextResponse.json(
      {
        success: true,
        data: { report_id: reportId, url: '#demo-download', expires_in: 604800 },
      },
      { status: 200 }
    );
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { reportId } = await params;
  const client = getSupabaseClient();

  const jobResult = await client.db.queryTable<ReportJobRow>(
    'outbox_jobs',
    `id=eq.${encodeURIComponent(reportId)}&select=id,payload,state&limit=1`
  );
  if (jobResult.error) {
    return NextResponse.json({ success: false, message: jobResult.error.message }, { status: 500 });
  }

  const job = jobResult.data[0] ?? null;
  if (!job) {
    return NextResponse.json({ success: false, message: 'Report not found.' }, { status: 404 });
  }

  const reportPayload = parseReportPayload(job.payload);
  if (!reportPayload) {
    return NextResponse.json({ success: false, message: 'Report payload is invalid.' }, { status: 500 });
  }

  if (!authResult.isAdmin) {
    if (!authResult.founder || authResult.founder.id !== reportPayload.founder_id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }
    if (!canAccessFounderEvent(authResult.roleAssignments, reportPayload.event_id)) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }
  }

  if (job.state !== 'completed') {
    return NextResponse.json({ success: false, message: 'Report is still generating.' }, { status: 409 });
  }

  const fileResult = await client.db.queryTable<FileRow>(
    'files',
    `owner_id=eq.${encodeURIComponent(reportPayload.founder_id)}&file_name=eq.${encodeURIComponent(`report-${job.id}.pdf`)}&select=id,owner_id,storage_path,signed_url_expiry&limit=1`
  );
  if (fileResult.error) {
    return NextResponse.json({ success: false, message: fileResult.error.message }, { status: 500 });
  }

  const file = fileResult.data[0] ?? null;
  if (!file) {
    return NextResponse.json({ success: false, message: 'Generated report file not found.' }, { status: 404 });
  }

  const storage = splitStoragePath(file.storage_path);
  if (!storage) {
    return NextResponse.json({ success: false, message: 'Generated report path is invalid.' }, { status: 500 });
  }

  const expiresIn = file.signed_url_expiry ?? SEVEN_DAYS_SECONDS;
  const signedUrlResult = await client.storage.createSignedUrl(storage.bucket, storage.relativePath, expiresIn);
  if (signedUrlResult.error || !signedUrlResult.signedUrl) {
    return NextResponse.json(
      { success: false, message: signedUrlResult.error?.message ?? 'Failed to create signed URL.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        report_id: reportId,
        url: signedUrlResult.signedUrl,
        expires_in: expiresIn,
      },
    },
    { status: 200 }
  );
}
