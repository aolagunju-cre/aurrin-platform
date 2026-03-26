import { NextRequest, NextResponse } from 'next/server';
import { SponsorRecord, SponsorTier, getSupabaseClient } from '../../../../lib/db/client';
import { getSponsorTierConfig } from '../../../../lib/sponsors/tier-config';

interface PublicSponsorRecord {
  id: string;
  name: string;
  logo: string | null;
  link: string | null;
  tier: SponsorTier;
  scope: 'event' | 'site-wide';
  event_id: string | null;
}

function buildTierRank(): Record<SponsorTier, number> {
  const byPriceDescending = getSponsorTierConfig()
    .slice()
    .sort((left, right) => right.pricing_cents - left.pricing_cents)
    .map((item) => item.tier);

  return byPriceDescending.reduce<Record<SponsorTier, number>>((result, tier, index) => {
    result[tier] = index;
    return result;
  }, { gold: 0, silver: 1, bronze: 2 });
}

function toPublicRecord(record: SponsorRecord): PublicSponsorRecord {
  return {
    id: record.id,
    name: record.name,
    logo: record.logo_url,
    link: record.website_url,
    tier: record.tier,
    scope: record.placement_scope,
    event_id: record.event_id,
  };
}

function sortSponsors(records: SponsorRecord[]): SponsorRecord[] {
  const tierRank = buildTierRank();

  return records.slice().sort((left, right) => {
    const tierDiff = tierRank[left.tier] - tierRank[right.tier];
    if (tierDiff !== 0) return tierDiff;

    const priorityDiff = left.display_priority - right.display_priority;
    if (priorityDiff !== 0) return priorityDiff;

    const createdAtDiff = Date.parse(left.created_at) - Date.parse(right.created_at);
    if (createdAtDiff !== 0) return createdAtDiff;

    return left.id.localeCompare(right.id);
  });
}

function isActiveForDisplay(record: SponsorRecord): boolean {
  if (record.status !== 'active') {
    return false;
  }

  if (!record.end_date) {
    return true;
  }

  return Date.parse(record.end_date) >= Date.now();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const eventId = request.nextUrl.searchParams.get('event_id')?.trim() || null;

  const sponsorsResult = await getSupabaseClient().db.listSponsors();
  if (sponsorsResult.error) {
    return NextResponse.json({ success: false, message: sponsorsResult.error.message }, { status: 500 });
  }

  const scoped = sponsorsResult.data.filter((record) => {
    if (!isActiveForDisplay(record)) {
      return false;
    }

    if (record.placement_scope === 'site-wide') {
      return true;
    }

    return Boolean(eventId) && record.placement_scope === 'event' && record.event_id === eventId;
  });

  return NextResponse.json(
    {
      success: true,
      data: sortSponsors(scoped).map(toPublicRecord),
    },
    { status: 200 }
  );
}
