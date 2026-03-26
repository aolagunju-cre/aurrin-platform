import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { auditLog } from '../../../../../../lib/audit/log';

type AccessType = 'perpetual' | 'time-limited';
type ProductStatus = 'draft' | 'active' | 'archived';

type UpdateDigitalProductBody = {
  name?: string;
  description?: string;
  stripe_price_link?: string;
  access_type?: AccessType;
  status?: ProductStatus;
  sales_count?: number;
  revenue_cents?: number;
  file_id?: string | null;
  file_path?: string | null;
};

function isAccessType(value: unknown): value is AccessType {
  return value === 'perpetual' || value === 'time-limited';
}

function isProductStatus(value: unknown): value is ProductStatus {
  return value === 'draft' || value === 'active' || value === 'archived';
}

function isUpdateBody(value: unknown): value is UpdateDigitalProductBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.trim().length === 0)) {
    return false;
  }
  if (payload.description !== undefined && typeof payload.description !== 'string') {
    return false;
  }
  if (payload.stripe_price_link !== undefined && (typeof payload.stripe_price_link !== 'string' || payload.stripe_price_link.trim().length === 0)) {
    return false;
  }
  if (payload.access_type !== undefined && !isAccessType(payload.access_type)) {
    return false;
  }
  if (payload.status !== undefined && !isProductStatus(payload.status)) {
    return false;
  }
  if (
    payload.sales_count !== undefined
    && (typeof payload.sales_count !== 'number' || !Number.isInteger(payload.sales_count) || payload.sales_count < 0)
  ) {
    return false;
  }
  if (
    payload.revenue_cents !== undefined
    && (typeof payload.revenue_cents !== 'number' || !Number.isInteger(payload.revenue_cents) || payload.revenue_cents < 0)
  ) {
    return false;
  }
  if (payload.file_id !== undefined && payload.file_id !== null && typeof payload.file_id !== 'string') {
    return false;
  }
  if (payload.file_path !== undefined && payload.file_path !== null && typeof payload.file_path !== 'string') {
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

  if (!isUpdateBody(body)) {
    return NextResponse.json({ success: false, message: 'Invalid digital product payload.' }, { status: 400 });
  }

  const { id } = await context.params;
  const updates = {
    name: body.name?.trim(),
    description: body.description?.trim(),
    stripe_product_id: body.stripe_price_link?.trim(),
    access_type: body.access_type,
    status: body.status,
    sales_count: body.sales_count,
    revenue_cents: body.revenue_cents,
    file_id: body.file_id,
    file_path: body.file_path,
    active: body.status === undefined ? undefined : body.status === 'active',
  };

  const result = await getSupabaseClient().db.updateProduct(id, updates);
  if (result.error || !result.data) {
    return NextResponse.json({ success: false, message: 'Could not update digital product.' }, { status: 500 });
  }

  await auditLog('digital_product_updated', auth.userId, {
    resource_type: 'digital_product',
    resource_id: id,
    changes: { after: updates },
  });

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
    return NextResponse.json({ success: false, message: 'Could not delete digital product.' }, { status: 500 });
  }

  await auditLog('digital_product_deleted', auth.userId, {
    resource_type: 'digital_product',
    resource_id: id,
    changes: { after: null },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
