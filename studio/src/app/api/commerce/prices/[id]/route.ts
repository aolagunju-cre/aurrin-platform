import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../lib/db/client';

function isPriceUpdate(value: unknown): value is {
  amount_cents?: number;
  currency?: string;
  billing_interval?: 'monthly' | 'yearly';
  stripe_price_id?: string | null;
  active?: boolean;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Record<string, unknown>;
  if (payload.amount_cents !== undefined && (typeof payload.amount_cents !== 'number' || payload.amount_cents <= 0)) {
    return false;
  }
  if (payload.currency !== undefined && typeof payload.currency !== 'string') {
    return false;
  }
  if (
    payload.billing_interval !== undefined
    && payload.billing_interval !== 'monthly'
    && payload.billing_interval !== 'yearly'
  ) {
    return false;
  }
  if (payload.stripe_price_id !== undefined && payload.stripe_price_id !== null && typeof payload.stripe_price_id !== 'string') {
    return false;
  }
  if (payload.active !== undefined && typeof payload.active !== 'boolean') {
    return false;
  }
  return true;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isPriceUpdate(body)) {
    return NextResponse.json({ success: false, message: 'Invalid price payload.' }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await getSupabaseClient().db.updatePrice(id, body);
  if (result.error || !result.data) {
    return NextResponse.json({ success: false, message: 'Could not update price' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const result = await getSupabaseClient().db.deletePrice(id);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Could not delete price' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
