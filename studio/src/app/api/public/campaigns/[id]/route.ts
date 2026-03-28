import { NextResponse } from 'next/server';
import { getCampaignById, listDonationsByCampaignId } from '../../../../../lib/campaigns/db';
import {
  isPublicCampaignStatus,
  type CampaignDonationRecord,
  type PublicCampaignDonation,
  toPublicCampaignSummary,
} from '../../../../../lib/campaigns/types';

function toPublicDonation(donation: CampaignDonationRecord): PublicCampaignDonation {
  return {
    id: donation.id,
    donor_name: donation.is_anonymous ? 'Anonymous' : (donation.donor_name ?? 'Supporter'),
    amount_cents: donation.amount_cents,
    created_at: donation.created_at,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const campaignResult = await getCampaignById(id);
  if (campaignResult.error || !campaignResult.data) {
    return NextResponse.json(
      { success: false, message: 'Campaign not found' },
      { status: 404 }
    );
  }

  if (!isPublicCampaignStatus(campaignResult.data.status)) {
    return NextResponse.json(
      { success: false, message: 'Campaign not found' },
      { status: 404 }
    );
  }

  const donationsResult = await listDonationsByCampaignId(id);
  if (donationsResult.error) {
    return NextResponse.json(
      { success: false, message: 'Failed to load campaign donations' },
      { status: 500 }
    );
  }

  const summary = toPublicCampaignSummary(campaignResult.data);
  if (!summary) {
    return NextResponse.json(
      { success: false, message: 'Campaign not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...summary,
      story: campaignResult.data.story,
      pledge_tiers: campaignResult.data.pledge_tiers,
      donations: (donationsResult.data ?? []).map(toPublicDonation),
    },
  });
}
