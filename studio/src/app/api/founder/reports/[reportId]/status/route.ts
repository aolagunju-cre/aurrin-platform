import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoFounderProfile } from '@/src/lib/demo/data';
import { canAccessFounderEvent, requireFounderOrAdmin } from '../../../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ reportId: string }>;
}

interface ReportJobRow {
  id: string;
  payload: Record<string, unknown> | null;
  state: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  last_error: string | null;
}

interface FileRow {
  id: string;
}

interface ReportPayload {
  founder_id: string;
  event_id: string;
  pitch_id: string;
  report_type: 'full' | 'summary';
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

function statusFromJobState(state: ReportJobRow['state'], hasFile: boolean): 'generating' | 'ready' | 'failed' {
  if (state === 'failed' || state === 'dead_letter') {
    return 'failed';
  }
  if (state === 'completed' && hasFile) {
    return 'ready';
  }
  return 'generating';
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (DEMO_MODE) {
    const { reportId } = await params;
    return NextResponse.json(
      {
        success: true,
        data: {
          report_id: reportId,
          founder_id: demoFounderProfile.id,
          event_id: 'evt-002',
          pitch_id: 'pitch-001',
          report_type: 'score_breakdown',
          status: 'ready',
          created_at: '2026-02-25T00:00:00.000Z',
          completed_at: '2026-02-25T00:00:00.000Z',
          download_url: `/api/founder/reports/${reportId}/download`,
          error: null,
        },
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
    `id=eq.${encodeURIComponent(reportId)}&select=id,payload,state,created_at,completed_at,error_message,last_error&limit=1`
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

  const fileResult = await client.db.queryTable<FileRow>(
    'files',
    `owner_id=eq.${encodeURIComponent(reportPayload.founder_id)}&file_name=eq.${encodeURIComponent(`report-${job.id}.pdf`)}&select=id&limit=1`
  );
  if (fileResult.error) {
    return NextResponse.json({ success: false, message: fileResult.error.message }, { status: 500 });
  }

  const hasFile = Boolean(fileResult.data[0]);
  const status = statusFromJobState(job.state, hasFile);

  return NextResponse.json(
    {
      success: true,
      data: {
        report_id: job.id,
        founder_id: reportPayload.founder_id,
        event_id: reportPayload.event_id,
        pitch_id: reportPayload.pitch_id,
        report_type: reportPayload.report_type,
        status,
        created_at: job.created_at,
        completed_at: job.completed_at,
        download_url: status === 'ready' ? `/api/founder/reports/${job.id}/download` : null,
        error: job.error_message ?? job.last_error,
      },
    },
    { status: 200 }
  );
}
