import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient, FounderPitchUpdate } from '../../../../../../lib/db/client';
import { sendEmail } from '../../../../../../lib/email/send';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface FounderApplicationStatusRow {
  email: string;
  status: 'pending' | 'accepted' | 'assigned' | 'declined';
  updated_at: string;
}

interface DirectoryPublishingPayload {
  founder_ids?: string[];
  auto_publish_accepted?: boolean;
  visible?: boolean;
}

interface DirectoryPublishCandidate {
  founder_id: string;
  founder_name: string | null;
  founder_email: string | null;
  company_name: string | null;
  pitch_id: string;
  visible_in_directory: boolean;
  is_published: boolean;
  public_profile_slug: string | null;
  application_status: FounderApplicationStatusRow['status'] | null;
  eligible_for_auto_publish: boolean;
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveBaseUrl(): string {
  const candidate =
    process.env.APP_BASE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (candidate) {
    return candidate.replace(/\/+$/, '');
  }
  return 'https://app.aurrin.ventures';
}

function selectLatestApplicationByEmail(rows: FounderApplicationStatusRow[]): Map<string, FounderApplicationStatusRow> {
  const byEmail = new Map<string, FounderApplicationStatusRow>();
  for (const row of rows) {
    const email = normalizeText(row.email)?.toLowerCase();
    if (!email) {
      continue;
    }

    const current = byEmail.get(email);
    if (!current || Date.parse(row.updated_at) > Date.parse(current.updated_at)) {
      byEmail.set(email, row);
    }
  }
  return byEmail;
}

function isPublishingAllowed(eventStatus: string, publishingStart: string | null): boolean {
  if (eventStatus !== 'archived') {
    return false;
  }
  if (!publishingStart) {
    return false;
  }
  const publishStartDate = new Date(publishingStart);
  if (Number.isNaN(publishStartDate.getTime())) {
    return false;
  }
  return new Date() >= publishStartDate;
}

async function loadCandidates(eventId: string): Promise<{
  candidates: DirectoryPublishCandidate[];
  error: Error | null;
}> {
  const client = getSupabaseClient();
  const pitchesResult = await client.db.listFounderPitchesByEventId(eventId);
  if (pitchesResult.error) {
    return { candidates: [], error: pitchesResult.error };
  }

  const pitches = pitchesResult.data;
  const emails = Array.from(
    new Set(
      pitches
        .map((pitch) => normalizeText(pitch.founder?.user?.email ?? null)?.toLowerCase())
        .filter((email): email is string => Boolean(email))
    )
  );

  let latestApplicationsByEmail = new Map<string, FounderApplicationStatusRow>();
  if (emails.length > 0) {
    const encodedEmails = emails.map((email) => `"${email.replace(/"/g, '\\"')}"`).join(',');
    const applicationsResult = await client.db.queryTable<FounderApplicationStatusRow>(
      'founder_applications',
      `email=in.(${encodeURIComponent(encodedEmails)})&select=email,status,updated_at&limit=2000`
    );

    if (applicationsResult.error) {
      return { candidates: [], error: applicationsResult.error };
    }

    latestApplicationsByEmail = selectLatestApplicationByEmail(applicationsResult.data);
  }

  const candidates = pitches.map((pitch) => {
    const founderEmail = normalizeText(pitch.founder?.user?.email ?? null)?.toLowerCase() ?? null;
    const applicationStatus = founderEmail ? latestApplicationsByEmail.get(founderEmail)?.status ?? null : null;
    const eligibleForAutoPublish = applicationStatus === 'accepted' || applicationStatus === 'assigned';

    return {
      founder_id: pitch.founder_id,
      founder_name: normalizeText(pitch.founder?.user?.name ?? null),
      founder_email: founderEmail,
      company_name: normalizeText(pitch.founder?.company_name ?? null),
      pitch_id: pitch.id,
      visible_in_directory: pitch.visible_in_directory,
      is_published: pitch.is_published,
      public_profile_slug: pitch.public_profile_slug,
      application_status: applicationStatus,
      eligible_for_auto_publish: eligibleForAutoPublish,
    };
  });

  return { candidates, error: null };
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;
  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const candidatesResult = await loadCandidates(id);
  if (candidatesResult.error) {
    return NextResponse.json({ success: false, message: candidatesResult.error.message }, { status: 500 });
  }

  const publishingAllowed = isPublishingAllowed(eventResult.data.status, eventResult.data.publishing_start);

  return NextResponse.json(
    {
      success: true,
      data: {
        event_id: id,
        publishing_allowed: publishingAllowed,
        publishing_gate_reason: publishingAllowed
          ? null
          : 'Publishing controls are available only after the event is archived and scores are published.',
        candidates: candidatesResult.candidates,
      },
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: DirectoryPublishingPayload;
  try {
    body = await request.json() as DirectoryPublishingPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const requestedFounderIds = Array.from(new Set(body.founder_ids ?? []));
  if (requestedFounderIds.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
    return NextResponse.json({ success: false, message: 'founder_ids must contain only non-empty ids.' }, { status: 400 });
  }

  if (!body.auto_publish_accepted && requestedFounderIds.length === 0) {
    return NextResponse.json(
      { success: false, message: 'Provide founder_ids or set auto_publish_accepted=true.' },
      { status: 400 }
    );
  }

  if (body.visible !== undefined && typeof body.visible !== 'boolean') {
    return NextResponse.json({ success: false, message: 'visible must be boolean when provided.' }, { status: 400 });
  }
  const visible = body.visible ?? true;

  const { id } = await params;
  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  if (!isPublishingAllowed(eventResult.data.status, eventResult.data.publishing_start)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Publish Founders to Directory is only available after event completion and score publication.',
      },
      { status: 409 }
    );
  }

  const candidatesResult = await loadCandidates(id);
  if (candidatesResult.error) {
    return NextResponse.json({ success: false, message: candidatesResult.error.message }, { status: 500 });
  }

  const candidatesByFounderId = new Map<string, DirectoryPublishCandidate>();
  for (const candidate of candidatesResult.candidates) {
    candidatesByFounderId.set(candidate.founder_id, candidate);
  }

  const targetFounderIds = new Set<string>(requestedFounderIds);
  if (body.auto_publish_accepted) {
    for (const candidate of candidatesResult.candidates) {
      if (candidate.eligible_for_auto_publish) {
        targetFounderIds.add(candidate.founder_id);
      }
    }
  }

  const unknownFounderIds = Array.from(targetFounderIds).filter((id) => !candidatesByFounderId.has(id));
  if (unknownFounderIds.length > 0) {
    return NextResponse.json(
      { success: false, message: `Founders not assigned to this event: ${unknownFounderIds.join(', ')}` },
      { status: 404 }
    );
  }

  const baseUrl = resolveBaseUrl();
  const nowIso = new Date().toISOString();
  const updatedFounderIds: string[] = [];
  const notifiedFounderIds: string[] = [];

  for (const founderId of targetFounderIds) {
    const candidate = candidatesByFounderId.get(founderId) as DirectoryPublishCandidate;
    const alreadyInRequestedState = candidate.visible_in_directory === visible;
    if (alreadyInRequestedState) {
      continue;
    }

    const updates: FounderPitchUpdate = {
      visible_in_directory: visible,
      is_published: visible ? true : candidate.is_published,
    };
    if (visible && !candidate.is_published) {
      updates.published_at = nowIso;
    }

    const updateResult = await client.db.updateFounderPitch(candidate.pitch_id, updates);

    if (updateResult.error || !updateResult.data) {
      return NextResponse.json(
        { success: false, message: updateResult.error?.message ?? 'Failed to update founder directory visibility.' },
        { status: 500 }
      );
    }

    updatedFounderIds.push(founderId);
    if (visible && !candidate.visible_in_directory && candidate.founder_email && candidate.public_profile_slug) {
      await sendEmail(candidate.founder_email, 'directory_published', {
        name: candidate.founder_name ?? 'Founder',
        company: candidate.company_name ?? 'your company',
        link: `${baseUrl}/public/directory/${candidate.public_profile_slug}`,
        email: candidate.founder_email,
      });
      notifiedFounderIds.push(founderId);
    }
  }

  await auditLog(
    'directory_visibility_batch_updated',
    authResult.userId,
    {
      resource_type: 'event',
      resource_id: id,
      changes: {
        founder_ids: Array.from(targetFounderIds),
        updated_founder_ids: updatedFounderIds,
        visibility: visible,
        auto_publish_accepted: body.auto_publish_accepted ?? false,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        event_id: id,
        visibility: visible,
        requested_founder_ids: Array.from(targetFounderIds),
        updated_founder_ids: updatedFounderIds,
        notified_founder_ids: notifiedFounderIds,
        idempotent: updatedFounderIds.length === 0,
      },
    },
    { status: 200 }
  );
}
