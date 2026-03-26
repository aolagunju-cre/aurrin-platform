import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../lib/db/client';
import { auditLog } from '../../../../../lib/audit/log';

type AccessType = 'perpetual' | 'time-limited';
type ProductStatus = 'draft' | 'active' | 'archived';

type CreateDigitalProductBody = {
  name: string;
  description: string;
  stripe_price_link: string;
  access_type: AccessType;
  status?: ProductStatus;
};

function isAccessType(value: unknown): value is AccessType {
  return value === 'perpetual' || value === 'time-limited';
}

function isProductStatus(value: unknown): value is ProductStatus {
  return value === 'draft' || value === 'active' || value === 'archived';
}

function isCreateBody(value: unknown): value is CreateDigitalProductBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.name === 'string'
    && payload.name.trim().length > 0
    && typeof payload.description === 'string'
    && typeof payload.stripe_price_link === 'string'
    && payload.stripe_price_link.trim().length > 0
    && isAccessType(payload.access_type)
    && (payload.status === undefined || isProductStatus(payload.status))
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const result = await getSupabaseClient().db.listProducts(false);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Could not load digital products.' }, { status: 500 });
  }

  const data = result.data
    .filter((product) => product.product_type === 'digital')
    .map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      stripe_price_link: product.stripe_product_id,
      access_type: product.access_type ?? 'perpetual',
      file_id: product.file_id,
      file_path: product.file_path,
      sales_count: product.sales_count ?? 0,
      revenue_cents: product.revenue_cents ?? 0,
      status: product.status ?? (product.active ? 'active' : 'archived'),
    }));

  return NextResponse.json({ success: true, data }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  if (!isCreateBody(body)) {
    return NextResponse.json(
      { success: false, message: 'Invalid payload. Required: name, description, stripe_price_link, access_type.' },
      { status: 400 }
    );
  }

  const result = await getSupabaseClient().db.insertProduct({
    name: body.name.trim(),
    description: body.description.trim(),
    stripe_product_id: body.stripe_price_link.trim(),
    product_type: 'digital',
    access_type: body.access_type,
    sales_count: 0,
    revenue_cents: 0,
    status: body.status ?? 'active',
    active: (body.status ?? 'active') === 'active',
  });

  if (result.error || !result.data) {
    return NextResponse.json({ success: false, message: 'Could not create digital product.' }, { status: 500 });
  }

  await auditLog('digital_product_created', auth.userId, {
    resource_type: 'digital_product',
    resource_id: result.data.id,
    changes: { after: result.data },
  });

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
