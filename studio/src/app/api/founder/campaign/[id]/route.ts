import { NextRequest, NextResponse } from 'next/server';
import { requireFounderOrAdmin } from '../../../../../lib/auth/founder';
import { getCampaignById, updateCampaign } from '../../../../../lib/campaigns/db';
import type { PledgeTier } from '../../../../../lib/campaigns/types';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const result = await getCampaignById(id);

  if (result.error || !result.data) {
    return NextResponse.json(
      { success: false, message: 'Campaign not found' },
      { status: 404 }
    );
  }

  if (!authResult.isAdmin && result.data.founder_id !== authResult.founder?.id) {
    return NextResponse.json(
      { success: false, message: 'Forbidden' },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const existing = await getCampaignById(id);

  if (existing.error || !existing.data) {
    return NextResponse.json(
      { success: false, message: 'Campaign not found' },
      { status: 404 }
    );
  }

  if (!authResult.isAdmin && existing.data.founder_id !== authResult.founder?.id) {
    return NextResponse.json(
      { success: false, message: 'Forbidden' },
      { status: 403 }
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

  const updates: Record<string, unknown> = {};

  if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.description === 'string') updates.description = body.description.trim();
  if (typeof body.story === 'string') updates.story = body.story.trim();
  if (typeof body.funding_goal_cents === 'number' && body.funding_goal_cents >= 100) {
    updates.funding_goal_cents = body.funding_goal_cents;
  }
  if (typeof body.e_transfer_email === 'string') updates.e_transfer_email = body.e_transfer_email.trim();
  if (body.status === 'draft' || body.status === 'active' || body.status === 'funded' || body.status === 'closed') {
    updates.status = body.status;
  }
  if (Array.isArray(body.pledge_tiers)) {
    updates.pledge_tiers = body.pledge_tiers.filter(isValidPledgeTier);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, message: 'No valid updates provided' },
      { status: 400 }
    );
  }

  const result = await updateCampaign(id, updates);
  if (result.error || !result.data) {
    return NextResponse.json(
      { success: false, message: 'Failed to update campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
