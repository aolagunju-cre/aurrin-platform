import { getSupabaseClient } from '../db/client';
import type { SponsorshipTierRecord } from '../db/client';
import { slugifyCompanyName } from '../directory/slug';
import { DEMO_MODE } from '../demo/data';

export interface PublicFounderSponsorshipProfile {
  founderId: string;
  userId: string;
  founderSlug: string;
  name: string | null;
  photo: string | null;
  company: string | null;
  bio: string | null;
  industry: string | null;
  stage: string | null;
  socialLinks: {
    website: string | null;
    twitter: string | null;
    linkedin: string | null;
  };
  fundingGoalCents: number | null;
  totalDonatedCents: number;
  tiers: SponsorshipTierRecord[];
  pastEvents: Array<{
    id: string;
    eventName: string;
    scoreAggregate: number | null;
    publishedAt: string | null;
  }>;
  mentorEndorsements: Array<{
    mentorId: string;
    mentorName: string | null;
  }>;
}

interface FounderWithUserRow {
  id: string;
  user_id: string;
  company_name: string | null;
  bio: string | null;
  website: string | null;
  social_proof: Record<string, unknown> | null;
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
}

interface FounderApplicationRow {
  industry: string | null;
  stage: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  funding_goal_cents: number | null;
}

interface DonationRow {
  amount_cents: number;
}

interface FounderPitchRow {
  id: string;
  score_aggregate: number | null;
  published_at: string | null;
  event: {
    id: string;
    name: string;
  } | null;
}

interface MentorMatchRow {
  mentor_id: string;
  mentor: {
    name: string | null;
  } | null;
}

function getStringField(source: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!source) return null;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

const DEMO_PROFILE: PublicFounderSponsorshipProfile = {
  founderId: 'demo-founder-1',
  userId: 'demo-user-1',
  founderSlug: 'terravolt-energy',
  name: 'Maya Chen',
  photo: null,
  company: 'TerraVolt Energy',
  bio: 'Building modular battery storage for off-grid communities in Northern Alberta. Deployed 3 pilot units serving 120 households.',
  industry: 'CleanTech',
  stage: 'Seed',
  socialLinks: {
    website: 'https://terravolt.ca',
    twitter: null,
    linkedin: 'https://linkedin.com/in/mayachen',
  },
  fundingGoalCents: 1000000,
  totalDonatedCents: 375000,
  tiers: [
    {
      id: 'demo-tier-1',
      founder_id: 'demo-user-1',
      label: 'Community Supporter',
      amount_cents: 2500,
      perk_description: 'Thank-you email + name on our website',
      sort_order: 0,
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'demo-tier-2',
      founder_id: 'demo-user-1',
      label: 'Seed Backer',
      amount_cents: 10000,
      perk_description: '30-minute strategy call + quarterly updates',
      sort_order: 1,
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'demo-tier-3',
      founder_id: 'demo-user-1',
      label: 'Lead Backer',
      amount_cents: 50000,
      perk_description: 'Advisory board seat for 12 months + all lower perks',
      sort_order: 2,
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  pastEvents: [
    {
      id: 'evt-002',
      eventName: 'Aurrin Demo Day — February 2026',
      scoreAggregate: 87,
      publishedAt: '2026-02-23T09:00:00.000Z',
    },
  ],
  mentorEndorsements: [
    { mentorId: 'demo-mentor-1', mentorName: 'Jordan Ellis' },
  ],
};

export async function getPublicFounderProfileBySlug(slug: string): Promise<{
  data: PublicFounderSponsorshipProfile | null;
  error: Error | null;
}> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return { data: null, error: null };
  }

  if (DEMO_MODE) {
    if (DEMO_PROFILE.founderSlug === normalizedSlug) {
      return { data: DEMO_PROFILE, error: null };
    }
    return { data: null, error: null };
  }

  const client = getSupabaseClient();

  // Fetch founders joined with users — limited to 200 for slug matching in JS.
  // A DB-level slug column can replace this in a later migration.
  const foundersResult = await client.db.queryTable<FounderWithUserRow>(
    'founders',
    [
      'select=id,user_id,company_name,bio,website,social_proof,user:users!founders_user_id_fkey(id,name,avatar_url)',
      'order=created_at.asc',
      'limit=200',
    ].join('&')
  );

  if (foundersResult.error) {
    return { data: null, error: foundersResult.error };
  }

  const founderRow = foundersResult.data.find(
    (f) => f.company_name && slugifyCompanyName(f.company_name) === normalizedSlug
  ) ?? null;

  if (!founderRow) {
    return { data: null, error: null };
  }

  // Fetch founder_applications for industry, stage, social links, funding_goal
  const userId = founderRow.user_id;
  const applicationResult = await client.db.queryTable<FounderApplicationRow>(
    'founder_applications',
    [
      `select=industry,stage,website,twitter,linkedin,funding_goal_cents`,
      `email=eq.${encodeURIComponent(founderRow.user?.id ?? '')}`,
      'order=updated_at.desc',
      'limit=1',
    ].join('&')
  );

  // Best-effort — not fatal if missing
  const application = applicationResult.data[0] ?? null;

  // Fetch active sponsorship tiers sorted by sort_order
  const tiersResult = await client.db.listSponsorshipTiersByFounderId(userId);
  const activeTiers = tiersResult.data.filter((t) => t.active);

  // Sum completed donations
  const donationsResult = await client.db.queryTable<DonationRow>(
    'donations',
    [
      `founder_id=eq.${encodeURIComponent(userId)}`,
      'status=eq.completed',
      'select=amount_cents',
      'limit=1000',
    ].join('&')
  );
  const totalDonatedCents = donationsResult.data.reduce(
    (sum, row) => sum + (typeof row.amount_cents === 'number' ? row.amount_cents : 0),
    0
  );

  // Fetch published pitches (past events)
  const pitchesResult = await client.db.queryTable<FounderPitchRow>(
    'founder_pitches',
    [
      `founder_id=eq.${encodeURIComponent(founderRow.id)}`,
      'is_published=eq.true',
      'select=id,score_aggregate,published_at,event:events!founder_pitches_event_id_fkey(id,name)',
      'order=published_at.desc.nullslast',
      'limit=10',
    ].join('&')
  );
  const pastEvents = (pitchesResult.data ?? [])
    .filter((p) => p.event)
    .map((p) => ({
      id: p.event!.id,
      eventName: p.event!.name,
      scoreAggregate: typeof p.score_aggregate === 'number' ? p.score_aggregate : null,
      publishedAt: p.published_at,
    }));

  // Fetch accepted mentor endorsements
  const mentorResult = await client.db.queryTable<MentorMatchRow>(
    'mentor_matches',
    [
      `founder_id=eq.${encodeURIComponent(founderRow.id)}`,
      'mentor_status=eq.accepted',
      'founder_status=eq.accepted',
      'select=mentor_id,mentor:users!mentor_matches_mentor_id_fkey(name)',
      'limit=20',
    ].join('&')
  );
  const mentorEndorsements = (mentorResult.data ?? []).map((m) => ({
    mentorId: m.mentor_id,
    mentorName: m.mentor?.name ?? null,
  }));

  return {
    data: {
      founderId: founderRow.id,
      userId,
      founderSlug: normalizedSlug,
      name: founderRow.user?.name ?? null,
      photo: founderRow.user?.avatar_url ?? null,
      company: founderRow.company_name ?? null,
      bio: founderRow.bio ?? null,
      industry: application?.industry ?? null,
      stage: application?.stage ?? null,
      socialLinks: {
        website:
          application?.website ??
          founderRow.website ??
          getStringField(founderRow.social_proof, 'website'),
        twitter:
          application?.twitter ??
          getStringField(founderRow.social_proof, 'twitter'),
        linkedin:
          application?.linkedin ??
          getStringField(founderRow.social_proof, 'linkedin'),
      },
      fundingGoalCents: application?.funding_goal_cents ?? null,
      totalDonatedCents,
      tiers: activeTiers,
      pastEvents,
      mentorEndorsements,
    },
    error: null,
  };
}
