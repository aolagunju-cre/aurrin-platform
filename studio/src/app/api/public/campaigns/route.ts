import { NextRequest, NextResponse } from 'next/server';
import { listActiveCampaigns, insertCampaign } from '../../../../lib/campaigns/db';
import { toPublicCampaignSummary, type PublicCampaignSummary, type CampaignInsert } from '../../../../lib/campaigns/types';

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const {
    title,
    description,
    story,
    funding_goal_cents,
    duration_days,
    pledge_tiers,
    founder_email,
    category,
  } = body;

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 });
  }

  if (!funding_goal_cents || typeof funding_goal_cents !== 'number') {
    return NextResponse.json({ success: false, message: 'funding_goal_cents is required' }, { status: 400 });
  }

  const insert: CampaignInsert = {
    // Use anonymous founder ID for now — campaign founder linking comes later
    founder_id: '00000000-0000-0000-0000-000000000000',
    title,
    description: typeof description === 'string' ? description : undefined,
    story: typeof story === 'string' ? story : undefined,
    funding_goal_cents,
    e_transfer_email: typeof founder_email === 'string' ? founder_email : undefined,
    status: 'active',
    pledge_tiers: Array.isArray(pledge_tiers) ? pledge_tiers as CampaignInsert['pledge_tiers'] : [],
  };

  const result = await insertCampaign(insert);

  if (result.error || !result.data) {
    return NextResponse.json(
      { success: false, message: 'Failed to create campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: result.data.id }, { status: 201 });
}
