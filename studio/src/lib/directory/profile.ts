import { getSupabaseClient } from '../db/client';
import { DEMO_MODE, demoDirectoryProfiles, demoEvents } from '../demo/data';

export interface PublicDirectoryProfile {
  founder_id: string | null;
  founder_slug: string;
  name: string | null;
  company: string | null;
  industry: string | null;
  stage: string | null;
  summary: string | null;
  photo: string | null;
  score: number | null;
  social_links: {
    website: string | null;
    linkedin: string | null;
    twitter: string | null;
  };
  badges: string[];
  deck_link: string | null;
  event: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
  };
  donations: {
    count: number;
    total_cents: number;
  } | null;
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

function isFounderDonationStatsEnabled(): boolean {
  return /^(1|true|yes|on)$/iu.test(process.env.NEXT_PUBLIC_ENABLE_FOUNDER_DONATION_STATS ?? '');
}

async function getDonationSummaryForFounderSlug(founderSlug: string): Promise<{ count: number; total_cents: number } | null> {
  if (!isFounderDonationStatsEnabled() || DEMO_MODE) {
    return null;
  }

  const client = getSupabaseClient();
  const query = [
    'event_type=eq.payment_intent.succeeded',
    'status=eq.succeeded',
    `metadata->>kind=eq.${encodeURIComponent('founder_support')}`,
    `metadata->>founder_slug=eq.${encodeURIComponent(founderSlug)}`,
    'select=amount_cents',
    'limit=500',
  ].join('&');

  const result = await client.db.queryTable<{ amount_cents: number | null }>('transactions', query);
  if (result.error) {
    throw result.error;
  }

  const count = result.data.length;
  const total_cents = result.data.reduce(
    (sum, row) => sum + (typeof row.amount_cents === 'number' ? row.amount_cents : 0),
    0
  );
  return { count, total_cents };
}

function toDemoProfile(founderSlug: string): PublicDirectoryProfile | null {
  const profile = demoDirectoryProfiles.find((entry) => entry.founder_slug === founderSlug);
  if (!profile) {
    return null;
  }

  const event = demoEvents.find((entry) => entry.id === profile.event.id);

  return {
    founder_id: null,
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
    badges:
      profile.score && profile.score >= 80
        ? ['Top Score', 'Audience Favorite']
        : profile.score && profile.score >= 70
          ? ['Strong Pitch']
          : [],
    deck_link: null,
    event: {
      id: profile.event.id,
      name: profile.event.name,
      starts_at: event?.start_date ?? '2026-03-28T18:00:00.000Z',
      ends_at: event?.end_date ?? '2026-03-28T22:00:00.000Z',
    },
    donations: isFounderDonationStatsEnabled()
      ? {
          count: Math.max(0, Math.floor((profile.score ?? 0) / 10)),
          total_cents: Math.max(0, Math.floor((profile.score ?? 0) / 10)) * 2500,
        }
      : null,
  };
}

export async function getPublicDirectoryProfile(founderSlug: string): Promise<{
  data: PublicDirectoryProfile | null;
  error: Error | null;
}> {
  const normalizedSlug = normalizeText(founderSlug);
  if (!normalizedSlug) {
    return { data: null, error: null };
  }

  if (DEMO_MODE) {
    return { data: toDemoProfile(normalizedSlug), error: null };
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
    return { data: null, error: detailResult.error };
  }

  const row = detailResult.data[0] ?? null;
  if (!row || !row.public_profile_slug || !row.founder || !row.event || row.event.status !== 'archived') {
    return { data: null, error: null };
  }

  let application: FounderApplicationRow | null = null;
  const founderEmail = normalizeText(row.founder.user?.email ?? null);
  if (founderEmail) {
    const applicationResult = await client.db.queryTable<FounderApplicationRow>(
      'founder_applications',
      `email=eq.${encodeURIComponent(founderEmail)}&select=email,industry,stage,pitch_summary,website,twitter,linkedin&order=updated_at.desc&limit=1`
    );

    if (applicationResult.error) {
      return { data: null, error: applicationResult.error };
    }

    application = applicationResult.data[0] ?? null;
  }

  const donations = await getDonationSummaryForFounderSlug(row.public_profile_slug);

  return {
    data: {
      founder_id: row.founder.id,
      founder_slug: row.public_profile_slug,
      name: normalizeText(row.founder.user?.name ?? null),
      company: normalizeText(row.founder.company_name ?? null),
      industry: normalizeText(application?.industry ?? null),
      stage: normalizeText(application?.stage ?? null),
      summary: normalizeText(row.founder.bio ?? null) ?? normalizeText(application?.pitch_summary ?? null),
      photo: normalizeText(row.founder.user?.avatar_url ?? null),
      score: toSafeNumber(row.score_aggregate),
      social_links: {
        website:
          normalizeText(application?.website ?? null) ??
          normalizeText(row.founder.website ?? null) ??
          getStringField(row.founder.social_proof, 'website'),
        linkedin:
          normalizeText(application?.linkedin ?? null) ?? getStringField(row.founder.social_proof, 'linkedin'),
        twitter:
          normalizeText(application?.twitter ?? null) ?? getStringField(row.founder.social_proof, 'twitter'),
      },
      badges: toBadges(row.validation_summary),
      deck_link: normalizeText(row.pitch_deck_url ?? null),
      event: {
        id: row.event.id,
        name: row.event.name,
        starts_at: row.event.starts_at,
        ends_at: row.event.ends_at,
      },
      donations,
    },
    error: null,
  };
}
