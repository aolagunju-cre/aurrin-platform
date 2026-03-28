export type CampaignStatus = 'draft' | 'active' | 'funded' | 'closed';

export interface PledgeTier {
  name: string;
  amount_cents: number;
  description: string;
}

export interface CampaignRecord {
  id: string;
  founder_id: string;
  title: string;
  description: string | null;
  story: string | null;
  funding_goal_cents: number;
  amount_raised_cents: number;
  donor_count: number;
  e_transfer_email: string | null;
  status: CampaignStatus;
  pledge_tiers: PledgeTier[];
  created_at: string;
  updated_at: string;
}

export interface CampaignInsert {
  founder_id: string;
  title: string;
  description?: string;
  story?: string;
  funding_goal_cents: number;
  e_transfer_email?: string;
  status?: Extract<CampaignStatus, 'draft' | 'active'>;
  pledge_tiers?: PledgeTier[];
}

export interface CampaignUpdate {
  title?: string;
  description?: string;
  story?: string;
  funding_goal_cents?: number;
  e_transfer_email?: string;
  status?: CampaignStatus;
  pledge_tiers?: PledgeTier[];
}

export interface CampaignDonationRecord {
  id: string;
  campaign_id: string;
  donor_name: string | null;
  donor_email: string | null;
  amount_cents: number;
  is_anonymous: boolean;
  stripe_session_id: string | null;
  created_at: string;
}

export interface PublicCampaignSummary {
  id: string;
  title: string;
  description: string | null;
  funding_goal_cents: number;
  amount_raised_cents: number;
  donor_count: number;
  status: Extract<CampaignStatus, 'active' | 'funded'>;
}

export interface PublicCampaignDonation {
  id: string;
  donor_name: string;
  amount_cents: number;
  created_at: string;
}

export interface PublicCampaignDetail extends PublicCampaignSummary {
  story: string | null;
  pledge_tiers: PledgeTier[];
  donations: PublicCampaignDonation[];
}

export interface CampaignWithFounder extends CampaignRecord {
  founder_name: string | null;
  company_name: string | null;
}

export function isPublicCampaignStatus(
  status: CampaignStatus
): status is Extract<CampaignStatus, 'active' | 'funded'> {
  return status === 'active' || status === 'funded';
}

export function toPublicCampaignSummary(campaign: CampaignRecord): PublicCampaignSummary | null {
  if (!isPublicCampaignStatus(campaign.status)) {
    return null;
  }

  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    funding_goal_cents: campaign.funding_goal_cents,
    amount_raised_cents: campaign.amount_raised_cents,
    donor_count: campaign.donor_count,
    status: campaign.status,
  };
}
