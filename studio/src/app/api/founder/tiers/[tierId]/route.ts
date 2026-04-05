import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { requireFounderOrAdmin } from '../../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../../lib/db/client';

interface RouteContext {
  params: Promise<{ tierId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { tierId } = await context.params;

  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: { id: tierId } }, { status: 200 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.isFounder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const tierResult = await client.db.getSponsorshipTierById(tierId);
  if (tierResult.error) {
    return NextResponse.json({ success: false, message: 'Failed to fetch tier.' }, { status: 500 });
  }
  if (!tierResult.data) {
    return NextResponse.json({ success: false, message: 'Tier not found.' }, { status: 404 });
  }
  if (tierResult.data.founder_id !== authResult.userId) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const updates: {
    label?: string;
    amount_cents?: number;
    perk_description?: string;
    sort_order?: number;
    active?: boolean;
  } = {};

  if (typeof body.label === 'string' && body.label.trim()) {
    updates.label = body.label.trim();
  }
  if (typeof body.amount_cents === 'number' && body.amount_cents > 0) {
    updates.amount_cents = body.amount_cents;
  } else if (typeof body.amount_dollars === 'number' && body.amount_dollars > 0) {
    updates.amount_cents = Math.round(body.amount_dollars * 100);
  }
  if (typeof body.perk_description === 'string' && body.perk_description.trim()) {
    updates.perk_description = body.perk_description.trim();
  }
  if (typeof body.sort_order === 'number') {
    updates.sort_order = body.sort_order;
  }
  if (typeof body.active === 'boolean') {
    updates.active = body.active;
  }

  const result = await client.db.updateSponsorshipTier(tierId, updates);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Failed to update tier.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { tierId } = await context.params;

  if (DEMO_MODE) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.isFounder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const tierResult = await client.db.getSponsorshipTierById(tierId);
  if (tierResult.error) {
    return NextResponse.json({ success: false, message: 'Failed to fetch tier.' }, { status: 500 });
  }
  if (!tierResult.data) {
    return NextResponse.json({ success: false, message: 'Tier not found.' }, { status: 404 });
  }
  if (tierResult.data.founder_id !== authResult.userId) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const result = await client.db.deleteSponsorshipTier(tierId);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Failed to delete tier.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
