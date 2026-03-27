import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoFounderProfile } from '@/src/lib/demo/data';
import { requireFounderOrAdmin } from '../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../lib/db/client';

interface ReportJobRow {
  id: string;
  payload: Record<string, unknown> | null;
  state: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  last_error: string | null;
}

interface EventRow {
  id: string;
  name: string;
}

interface FileRow {
  id: string;
  owner_id: string;
  file_name: string;
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json(
      {
        success: true,
        data: demoFounderProfile.reports.map((r) => ({
          report_id: r.id,
          founder_id: demoFounderProfile.id,
          event_id: 'evt-002',
          event_name: r.event_name,
          pitch_id: 'pitch-001',
          report_type: r.type,
          status: 'ready',
          created_at: r.generated_at,
          completed_at: r.generated_at,
          download_url: `/api/founder/reports/${r.id}/download`,
          error: null,
        })),
      },
      { status: 200 }
    );
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const client = getSupabaseClient();
  const jobsResult = await client.db.queryTable<ReportJobRow>(
    'outbox_jobs',
    `job_type=in.(${encodeURIComponent('generate_pdf_report,pdf_generate')})&select=id,payload,state,created_at,completed_at,error_message,last_error&order=created_at.desc&limit=500`
  );

  if (jobsResult.error) {
    return NextResponse.json({ success: false, message: jobsResult.error.message }, { status: 500 });
  }

  const founderIdFilter = authResult.isAdmin
    ? request.nextUrl.searchParams.get('founder_id')
    : authResult.founder?.id ?? null;

  if (!authResult.isAdmin && !founderIdFilter) {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  const scopedJobs = jobsResult.data
    .map((job) => ({ job, parsedPayload: parseReportPayload(job.payload) }))
    .filter((entry) => entry.parsedPayload)
    .filter((entry) => !founderIdFilter || entry.parsedPayload?.founder_id === founderIdFilter) as Array<{
      job: ReportJobRow;
      parsedPayload: ReportPayload;
    }>;

  const founderIds = Array.from(new Set(scopedJobs.map((entry) => entry.parsedPayload.founder_id)));
  let filesByJobId = new Map<string, FileRow>();

  if (founderIds.length > 0) {
    const ownerFilter = founderIds.map((id) => `owner_id.eq.${id}`).join(',');
    const filesResult = await client.db.queryTable<FileRow>(
      'files',
      `or=(${encodeURIComponent(ownerFilter)})&storage_path=like.${encodeURIComponent('generated-reports/%')}&select=id,owner_id,file_name&limit=2000`
    );

    if (filesResult.error) {
      return NextResponse.json({ success: false, message: filesResult.error.message }, { status: 500 });
    }

    filesByJobId = new Map(
      filesResult.data
        .map((file) => {
          const match = /^report-([A-Za-z0-9-]+)\.pdf$/u.exec(file.file_name);
          if (!match) {
            return null;
          }
          return [match[1], file] as const;
        })
        .filter((entry): entry is readonly [string, FileRow] => Boolean(entry))
    );
  }

  const eventIds = Array.from(new Set(scopedJobs.map((entry) => entry.parsedPayload.event_id)));
  const eventsById = new Map<string, EventRow>();
  if (eventIds.length > 0) {
    const eventsResult = await client.db.listEventsByIds(eventIds);
    if (eventsResult.error) {
      return NextResponse.json({ success: false, message: eventsResult.error.message }, { status: 500 });
    }

    for (const event of eventsResult.data) {
      eventsById.set(event.id, { id: event.id, name: event.name });
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: scopedJobs.map(({ job, parsedPayload }) => {
        const hasFile = filesByJobId.has(job.id);
        const status = statusFromJobState(job.state, hasFile);
        return {
          report_id: job.id,
          founder_id: parsedPayload.founder_id,
          event_id: parsedPayload.event_id,
          event_name: eventsById.get(parsedPayload.event_id)?.name ?? null,
          pitch_id: parsedPayload.pitch_id,
          report_type: parsedPayload.report_type,
          status,
          created_at: job.created_at,
          completed_at: job.completed_at,
          download_url: status === 'ready' ? `/api/founder/reports/${job.id}/download` : null,
          error: job.error_message ?? job.last_error,
        };
      }),
    },
    { status: 200 }
  );
}
