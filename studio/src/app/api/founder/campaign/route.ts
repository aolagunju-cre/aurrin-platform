import { NextRequest, NextResponse } from 'next/server';
import { requireFounderOrAdmin } from '../../../../lib/auth/founder';
import { listCampaignsByFounderId, insertCampaign } from '../../../../lib/campaigns/db';
import type { PledgeTier } from '../../../../lib/campaigns/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.founder) {
    return NextResponse.json(
      { success: false, message: 'No founder profile found' },
      { status: 404 }
    );
  }

  const result = await listCampaignsByFounderId(authResult.founder.id);
  if (result.error) {
    return NextResponse.json(
      { success: false, message: 'Failed to load campaigns' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

function isValidPledgeTier(tier: unknown): tier is PledgeTier {
  if (!tier || typeof tier !== 'object') return false;
  const t = tier as Record<string, unknown>;
  return (
    typeof t.name === 'string' &&
    t.name.trim().length > 0 &&
    typeof t.amount_cents === 'number' &&
    t.amount_cents > 0 &&
    typeof t.description === 'string'
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.founder) {
    return NextResponse.json(
      { success: false, message: 'No founder profile found' },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const story = typeof body.story === 'string' ? body.story.trim() : '';
  const fundingGoalCents = typeof body.funding_goal_cents === 'number' ? body.funding_goal_cents : 0;
  const eTransferEmail = typeof body.e_transfer_email === 'string' ? body.e_transfer_email.trim() : '';
  const status = body.status === 'active' ? 'active' as const : 'draft' as const;
  const rawTiers = Array.isArray(body.pledge_tiers) ? body.pledge_tiers : [];
  const pledgeTiers = rawTiers.filter(isValidPledgeTier);

  if (!title) {
    return NextResponse.json(
      { success: false, message: 'Title is required' },
      { status: 400 }
    );
  }
  if (fundingGoalCents < 100) {
    return NextResponse.json(
      { success: false, message: 'Funding goal must be at least $1.00' },
      { status: 400 }
    );
  }

  const result = await insertCampaign({
    founder_id: authResult.founder.id,
    title,
    description: description || undefined,
    story: story || undefined,
    funding_goal_cents: fundingGoalCents,
    e_transfer_email: eTransferEmail || undefined,
    status,
    pledge_tiers: pledgeTiers.length > 0 ? pledgeTiers : undefined,
  });

  if (result.error || !result.data) {
    return NextResponse.json(
      { success: false, message: 'Failed to create campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
