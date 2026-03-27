export type SocialAssetType = 'profile' | 'highlight' | 'event';
export type SocialAssetFormat = 'twitter' | 'linkedin' | 'og';

export interface AssetDimensions {
  width: number;
  height: number;
}

export const SOCIAL_ASSET_DIMENSIONS: Record<SocialAssetFormat, AssetDimensions> = {
  twitter: { width: 1200, height: 628 },
  linkedin: { width: 1200, height: 627 },
  og: { width: 1200, height: 630 },
};

export interface ProfileCardData {
  founderName: string;
  companyName: string;
  score: string;
  date: string;
  eventName?: string;
}

export interface HighlightCardData {
  milestone: string;
  metric: string;
  founderName: string;
  date: string;
}

export interface EventCardData {
  eventName: string;
  date: string;
  totalFounders: number;
  topScore: string;
  participationSummary: string;
}

export type SocialAssetData = ProfileCardData | HighlightCardData | EventCardData;

export function parseSocialAssetType(value: unknown): SocialAssetType | null {
  if (value === 'profile' || value === 'highlight' || value === 'event') {
    return value;
  }
  return null;
}

export function parseSocialAssetFormat(value: unknown): SocialAssetFormat | null {
  if (value === 'twitter' || value === 'linkedin' || value === 'og') {
    return value;
  }
  return null;
}

export function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return value.trim();
}

export function requiredNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return value;
}
