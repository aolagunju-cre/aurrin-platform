import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { requireFounderOrAdmin } from '../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../lib/db/client';
import type { SponsorshipTierRecord } from '../../../../lib/db/client';

const DEMO_TIERS: SponsorshipTierRecord[] = [
  {
    id: 'demo-tier-1',
    founder_id: 'demo-founder-1',
    label: 'Bronze Supporter',
    amount_cents: 1000,
    perk_description: 'Name listed on our website',
    sort_order: 0,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-tier-2',
    founder_id: 'demo-founder-1',
    label: 'Silver Supporter',
    amount_cents: 5000,
    perk_description: 'Name listed + early access to updates',
    sort_order: 1,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: DEMO_TIERS }, { status: 200 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.isFounder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const result = await client.db.listSponsorshipTiersByFounderId(authResult.userId);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Failed to load tiers.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: DEMO_TIERS[0] }, { status: 201 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.isFounder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const label = body.label;
  const amountDollars = body.amount_dollars;
  const amountCents = body.amount_cents;
  const perkDescription = body.perk_description;
  const sortOrder = body.sort_order;

  if (typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ success: false, message: 'label is required.' }, { status: 400 });
  }

  let resolvedAmountCents: number;
  if (typeof amountCents === 'number') {
    resolvedAmountCents = amountCents;
  } else if (typeof amountDollars === 'number' && amountDollars > 0) {
    resolvedAmountCents = Math.round(amountDollars * 100);
  } else {
    return NextResponse.json({ success: false, message: 'amount_dollars (>0) is required.' }, { status: 400 });
  }

  if (resolvedAmountCents <= 0) {
    return NextResponse.json({ success: false, message: 'Amount must be greater than zero.' }, { status: 400 });
  }

  if (typeof perkDescription !== 'string' || !perkDescription.trim()) {
    return NextResponse.json({ success: false, message: 'perk_description is required.' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const result = await client.db.insertSponsorshipTier({
    founder_id: authResult.userId,
    label: label.trim(),
    amount_cents: resolvedAmountCents,
    perk_description: perkDescription.trim(),
    sort_order: typeof sortOrder === 'number' ? sortOrder : 0,
    active: true,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ success: false, message: 'Failed to create tier.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
