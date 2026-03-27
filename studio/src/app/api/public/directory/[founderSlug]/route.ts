import { NextResponse } from 'next/server';
import { DEMO_MODE, demoDirectoryProfiles, demoEvents } from '@/src/lib/demo/data';
import { getSupabaseClient } from '../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ founderSlug: string }>;
}

interface DirectoryPitchDetailRow {
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

function getStringField(source: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!source) {
    return null;
  }

  const value = source[key];
  return typeof value === 'string' ? normalizeText(value) : null;
}

function toBadges(validationSummary: Record<string, unknown> | null): string[] {
  if (!validationSummary || typeof validationSummary !== 'object') {
    return [];
  }

  const raw = validationSummary.badges;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((badge): badge is string => typeof badge === 'string' && badge.trim().length > 0);
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { founderSlug } = await params;
  const normalizedSlug = normalizeText(founderSlug);
  if (!normalizedSlug) {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  if (DEMO_MODE) {
    const profile = demoDirectoryProfiles.find((p) => p.founder_slug === normalizedSlug);
    if (!profile) {
      return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
    }
    return NextResponse.json(
      {
        success: true,
        data: {
          founder_slug: profile.founder_slug,
          name: profile.founder_name,
          company: profile.company,
          industry: profile.industry,
          stage: profile.stage,
          summary: profile.summary,
          photo: profile.photo,
          score: profile.score,
          social_links: {
            website: profile.company ? `https://${profile.company.toLowerCase().replace(/\s+/g, '')}.ca` : null,
            linkedin: profile.founder_name
              ? `https://linkedin.com/in/${profile.founder_name.toLowerCase().replace(/\s+/g, '')}`
              : null,
            twitter: null,
          },
          badges: profile.score && profile.score >= 80 ? ['Top Score', 'Audience Favorite'] : profile.score && profile.score >= 70 ? ['Strong Pitch'] : [],
          deck_link: null,
          event: (() => {
            const evt = demoEvents.find((e) => e.id === profile.event.id);
            return {
              id: profile.event.id,
              name: profile.event.name,
              starts_at: evt?.start_date ?? '2026-03-28T18:00:00.000Z',
              ends_at: evt?.end_date ?? '2026-03-28T22:00:00.000Z',
            };
          })(),
        },
      },
      { status: 200 }
    );
  }

  const client = getSupabaseClient();
  const detailResult = await client.db.queryTable<DirectoryPitchDetailRow>(
    'founder_pitches',
    [
      `public_profile_slug=eq.${encodeURIComponent(normalizedSlug)}`,
      'visible_in_directory=eq.true',
      'is_published=eq.true',
      'select=id,public_profile_slug,score_aggregate,pitch_deck_url,validation_summary,',
      'founder:founders!founder_pitches_founder_id_fkey(id,company_name,bio,website,social_proof,user:users!founders_user_id_fkey(name,email,avatar_url)),',
      'event:events!founder_pitches_event_id_fkey(id,name,status,starts_at,ends_at)',
      'limit=1',
    ].join('&')
  );

  if (detailResult.error) {
    return NextResponse.json({ success: false, message: detailResult.error.message }, { status: 500 });
  }

  const row = detailResult.data[0] ?? null;
  if (!row || !row.founder || !row.event || row.event.status !== 'archived') {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  let application: FounderApplicationRow | null = null;
  const founderEmail = normalizeText(row.founder.user?.email ?? null);
  if (founderEmail) {
    const applicationResult = await client.db.queryTable<FounderApplicationRow>(
      'founder_applications',
      `email=eq.${encodeURIComponent(founderEmail)}&select=email,industry,stage,pitch_summary,website,twitter,linkedin&order=updated_at.desc&limit=1`
    );

    if (applicationResult.error) {
      return NextResponse.json({ success: false, message: applicationResult.error.message }, { status: 500 });
    }

    application = applicationResult.data[0] ?? null;
  }

  const socialLinks = {
    website:
      normalizeText(application?.website ?? null) ??
      normalizeText(row.founder.website ?? null) ??
      getStringField(row.founder.social_proof, 'website'),
    linkedin:
      normalizeText(application?.linkedin ?? null) ?? getStringField(row.founder.social_proof, 'linkedin'),
    twitter:
      normalizeText(application?.twitter ?? null) ?? getStringField(row.founder.social_proof, 'twitter'),
  };

  return NextResponse.json(
    {
      success: true,
      data: {
        founder_slug: row.public_profile_slug,
        name: normalizeText(row.founder.user?.name ?? null),
        company: normalizeText(row.founder.company_name ?? null),
        industry: normalizeText(application?.industry ?? null),
        stage: normalizeText(application?.stage ?? null),
        summary: normalizeText(row.founder.bio ?? null) ?? normalizeText(application?.pitch_summary ?? null),
        photo: normalizeText(row.founder.user?.avatar_url ?? null),
        score: toSafeNumber(row.score_aggregate),
        social_links: socialLinks,
        badges: toBadges(row.validation_summary),
        deck_link: normalizeText(row.pitch_deck_url ?? null),
        event: {
          id: row.event.id,
          name: row.event.name,
          starts_at: row.event.starts_at,
          ends_at: row.event.ends_at,
        },
      },
    },
    { status: 200 }
  );
}
