import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../lib/db/client';

function isProductUpdate(value: unknown): value is {
  name?: string;
  description?: string | null;
  stripe_product_id?: string | null;
  active?: boolean;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Record<string, unknown>;
  if (payload.name !== undefined && typeof payload.name !== 'string') {
    return false;
  }
  if (payload.description !== undefined && payload.description !== null && typeof payload.description !== 'string') {
    return false;
  }
  if (payload.stripe_product_id !== undefined && payload.stripe_product_id !== null && typeof payload.stripe_product_id !== 'string') {
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

  if (!isProductUpdate(body)) {
    return NextResponse.json({ success: false, message: 'Invalid product payload.' }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await getSupabaseClient().db.updateProduct(id, body);
  if (result.error || !result.data) {
    return NextResponse.json({ success: false, message: 'Could not update product' }, { status: 500 });
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
  const result = await getSupabaseClient().db.deleteProduct(id);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Could not delete product' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
