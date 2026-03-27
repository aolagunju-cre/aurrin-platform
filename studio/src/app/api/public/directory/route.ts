import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';

const DEFAULT_PAGE_SIZE = 20;
const MAX_SOURCE_ROWS = 500;

interface DirectoryPitchRow {
  id: string;
  public_profile_slug: string | null;
  score_aggregate: number | null;
  pitch_deck_url: string | null;
  validation_summary: Record<string, unknown> | null;
  founder: {
    id: string;
    company_name: string | null;
    bio: string | null;
    website: string | null;
    social_proof: Record<string, unknown> | null;
    user: {
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
  event: {
    id: string;
    name: string;
    status: string;
    starts_at: string;
    ends_at: string;
  } | null;
}

interface FounderApplicationRow {
  email: string;
  industry: string | null;
  stage: string | null;
  pitch_summary: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  updated_at: string;
}

interface DirectoryProfileSummary {
  founder_slug: string;
  founder_name: string | null;
  company: string | null;
  industry: string | null;
  stage: string | null;
  summary: string | null;
  photo: string | null;
  score: number | null;
  event: {
    id: string;
    name: string;
  };
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSafeNumber(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(2));
}

function toBoundedScore(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, parsed));
}

function compareUpdatedAtDescending(left: FounderApplicationRow, right: FounderApplicationRow): number {
  return Date.parse(right.updated_at) - Date.parse(left.updated_at);
}

function buildApplicationsByEmail(rows: FounderApplicationRow[]): Map<string, FounderApplicationRow> {
  const grouped = new Map<string, FounderApplicationRow[]>();

  for (const row of rows) {
    const email = normalizeText(row.email)?.toLowerCase();
    if (!email) {
      continue;
    }

    const current = grouped.get(email) ?? [];
    current.push(row);
    grouped.set(email, current);
  }

  const latestByEmail = new Map<string, FounderApplicationRow>();
  for (const [email, emailRows] of grouped.entries()) {
    latestByEmail.set(email, emailRows.sort(compareUpdatedAtDescending)[0]);
  }

  return latestByEmail;
}

function matchesSearch(searchTerm: string | null, fields: Array<string | null>): boolean {
  if (!searchTerm) {
    return true;
  }

  const normalizedSearch = searchTerm.toLowerCase();
  return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(normalizedSearch));
}

function matchesEqualsFilter(filterValue: string | null, sourceValue: string | null): boolean {
  if (!filterValue) {
    return true;
  }

  if (!sourceValue) {
    return false;
  }

  return sourceValue.toLowerCase() === filterValue.toLowerCase();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const search = normalizeText(request.nextUrl.searchParams.get('search'));
  const industry = normalizeText(request.nextUrl.searchParams.get('industry'));
  const stage = normalizeText(request.nextUrl.searchParams.get('stage'));
  const eventId = normalizeText(request.nextUrl.searchParams.get('event'));
  const minScore = toBoundedScore(request.nextUrl.searchParams.get('minScore'), 0);
  const maxScore = toBoundedScore(request.nextUrl.searchParams.get('maxScore'), 100);

  const boundedMinScore = Math.min(minScore, maxScore);
  const boundedMaxScore = Math.max(minScore, maxScore);

  const client = getSupabaseClient();
  const listingResult = await client.db.queryTable<DirectoryPitchRow>(
    'founder_pitches',
    [
      'visible_in_directory=eq.true',
      'is_published=eq.true',
      'public_profile_slug=not.is.null',
      'select=id,public_profile_slug,score_aggregate,pitch_deck_url,validation_summary,',
      'founder:founders!founder_pitches_founder_id_fkey(id,company_name,bio,website,social_proof,user:users!founders_user_id_fkey(name,email,avatar_url)),',
      'event:events!founder_pitches_event_id_fkey(id,name,status,starts_at,ends_at)',
      'order=published_at.desc.nullslast,updated_at.desc',
      `limit=${MAX_SOURCE_ROWS}`,
    ].join('&')
  );

  if (listingResult.error) {
    return NextResponse.json({ success: false, message: listingResult.error.message }, { status: 500 });
  }

  const eligibleRows = listingResult.data.filter((row) => {
    if (!row.event || !row.founder || !row.public_profile_slug) {
      return false;
    }

    return row.event.status === 'archived';
  });

  const emails = Array.from(
    new Set(
      eligibleRows
        .map((row) => normalizeText(row.founder?.user?.email ?? null)?.toLowerCase())
        .filter((email): email is string => Boolean(email))
    )
  );

  let applicationsByEmail = new Map<string, FounderApplicationRow>();
  if (emails.length > 0) {
    const encodedEmails = emails.map((email) => `"${email.replace(/"/g, '\\"')}"`).join(',');
    const applicationsResult = await client.db.queryTable<FounderApplicationRow>(
      'founder_applications',
      `email=in.(${encodeURIComponent(encodedEmails)})&select=email,industry,stage,pitch_summary,website,twitter,linkedin,updated_at&limit=2000`
    );

    if (applicationsResult.error) {
      return NextResponse.json({ success: false, message: applicationsResult.error.message }, { status: 500 });
    }

    applicationsByEmail = buildApplicationsByEmail(applicationsResult.data);
  }

  const summaries: DirectoryProfileSummary[] = [];
  for (const row of eligibleRows) {
    const event = row.event;
    if (!event) {
      continue;
    }

    const founderEmail = normalizeText(row.founder?.user?.email ?? null)?.toLowerCase() ?? null;
    const application = founderEmail ? applicationsByEmail.get(founderEmail) ?? null : null;

    const score = toSafeNumber(row.score_aggregate);
    if (score !== null && (score < boundedMinScore || score > boundedMaxScore)) {
      continue;
    }

    if (score === null && (boundedMinScore > 0 || boundedMaxScore < 100)) {
      continue;
    }

    const summaryText = normalizeText(row.founder?.bio) ?? normalizeText(application?.pitch_summary ?? null);
    const company = normalizeText(row.founder?.company_name ?? null);
    const founderName = normalizeText(row.founder?.user?.name ?? null);
    const industryValue = normalizeText(application?.industry ?? null);
    const stageValue = normalizeText(application?.stage ?? null);

    if (!matchesEqualsFilter(industry, industryValue)) {
      continue;
    }

    if (!matchesEqualsFilter(stage, stageValue)) {
      continue;
    }

    if (eventId && event.id !== eventId) {
      continue;
    }

    if (!matchesSearch(search, [company, founderName, summaryText])) {
      continue;
    }

    summaries.push({
      founder_slug: row.public_profile_slug ?? row.id,
      founder_name: founderName,
      company,
      industry: industryValue,
      stage: stageValue,
      summary: summaryText,
      photo: normalizeText(row.founder?.user?.avatar_url ?? null),
      score,
      event: {
        id: event.id,
        name: event.name,
      },
    });
  }

  const pagedData = summaries.slice(0, DEFAULT_PAGE_SIZE);

  return NextResponse.json(
    {
      success: true,
      data: pagedData,
      pagination: {
        page: 1,
        page_size: DEFAULT_PAGE_SIZE,
        total: summaries.length,
        total_pages: summaries.length === 0 ? 0 : Math.ceil(summaries.length / DEFAULT_PAGE_SIZE),
      },
      applied_filters: {
        search,
        industry,
        stage,
        event: eventId,
        minScore: boundedMinScore,
        maxScore: boundedMaxScore,
      },
    },
    { status: 200 }
  );
}
