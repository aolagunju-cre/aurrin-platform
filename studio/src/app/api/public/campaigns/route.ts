import { NextResponse } from 'next/server';
import { listActiveCampaigns } from '../../../../lib/campaigns/db';
import { toPublicCampaignSummary, type PublicCampaignSummary } from '../../../../lib/campaigns/types';

export async function GET(): Promise<NextResponse> {
  const result = await listActiveCampaigns();

  if (result.error) {
    return NextResponse.json(
      { success: false, message: 'Failed to load campaigns' },
      { status: 500 }
    );
  }

  const campaigns = result.data
    .map(toPublicCampaignSummary)
    .filter((campaign): campaign is PublicCampaignSummary => campaign !== null);

  return NextResponse.json({
    success: true,
    data: campaigns,
  });
}
