import { SponsorTier } from '../db/client';

export interface SponsorTierConfigEntry {
  tier: SponsorTier;
  pricing_cents: number;
}

const DEFAULT_SPONSOR_TIER_CONFIG: SponsorTierConfigEntry[] = [
  { tier: 'bronze', pricing_cents: 50000 },
  { tier: 'silver', pricing_cents: 100000 },
  { tier: 'gold', pricing_cents: 250000 },
];

export function getSponsorTierConfig(): SponsorTierConfigEntry[] {
  const raw = process.env.SPONSOR_TIER_CONFIG_JSON;
  if (!raw) {
    return DEFAULT_SPONSOR_TIER_CONFIG;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_SPONSOR_TIER_CONFIG;
    }

    const normalized = parsed
      .filter((entry): entry is { tier: SponsorTier; pricing_cents: number } => (
        typeof entry === 'object'
        && entry !== null
        && ['bronze', 'silver', 'gold'].includes((entry as { tier?: string }).tier ?? '')
        && Number.isInteger((entry as { pricing_cents?: number }).pricing_cents)
        && ((entry as { pricing_cents?: number }).pricing_cents ?? 0) >= 0
      ))
      .map((entry) => ({ tier: entry.tier, pricing_cents: entry.pricing_cents }));

    if (normalized.length === 3) {
      return normalized;
    }
  } catch {
    return DEFAULT_SPONSOR_TIER_CONFIG;
  }

  return DEFAULT_SPONSOR_TIER_CONFIG;
}

export function getDefaultPricingForTier(tier: SponsorTier): number {
  return getSponsorTierConfig().find((entry) => entry.tier === tier)?.pricing_cents ?? 0;
}
