import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { canAccessFounderEvent, requireFounderOrAdmin } from '../../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../../lib/db/client';
import { enqueueJob } from '../../../../../lib/jobs/enqueue';

type ReportType = 'full' | 'summary';

interface FounderPitchRow {
  id: string;
  founder_id: string;
  event_id: string;
}

function parseReportType(value: unknown): ReportType | null {
  return value === 'full' || value === 'summary' ? value : null;
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json(
      {
        success: true,
        data: { job_id: 'demo-job-001', status_url: '/api/founder/reports/demo-job-001/status' },
        message: "Your report is being generated. You'll receive an email when ready.",
      },
      { status: 202 }
    );
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const eventId = parseString(body.event_id);
  const pitchId = parseString(body.pitch_id);
  const reportType = parseReportType(body.report_type);

  if (!eventId || !pitchId || !reportType) {
    return NextResponse.json(
      { success: false, message: 'Request body must include event_id, pitch_id, and report_type (full|summary).' },
      { status: 400 }
    );
  }

  if (!authResult.isAdmin && !canAccessFounderEvent(authResult.roleAssignments, eventId)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const pitchResult = await client.db.queryTable<FounderPitchRow>(
    'founder_pitches',
    `id=eq.${encodeURIComponent(pitchId)}&event_id=eq.${encodeURIComponent(eventId)}&select=id,founder_id,event_id&limit=1`
  );

  if (pitchResult.error) {
    return NextResponse.json({ success: false, message: pitchResult.error.message }, { status: 500 });
  }

  const pitch = pitchResult.data[0] ?? null;
  if (!pitch) {
    return NextResponse.json({ success: false, message: 'Founder pitch not found for event.' }, { status: 404 });
  }

  if (!authResult.isAdmin) {
    if (!authResult.founder || authResult.founder.id !== pitch.founder_id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }
  }

  const job = await enqueueJob(
    'generate_pdf_report',
    {
      founder_id: pitch.founder_id,
      event_id: pitch.event_id,
      pitch_id: pitch.id,
      report_type: reportType,
    },
    {
      aggregate_id: pitch.id,
      aggregate_type: 'founder_pitch',
    }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        job_id: job.id,
        status_url: `/api/founder/reports/${job.id}/status`,
      },
      message: "Your report is being generated. You'll receive an email when ready.",
    },
    { status: 202 }
  );
}
