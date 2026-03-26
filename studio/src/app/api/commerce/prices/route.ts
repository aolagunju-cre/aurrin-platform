import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';
import { requireAdmin } from '../../../../lib/auth/admin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams;
  const productId = searchParams.get('product_id');

  if (!productId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'product_id query parameter is required.',
        },
      },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();
  const result = await client.db.listPricesByProductId(productId, true);
  if (result.error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Could not load prices',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: result.data,
    },
    { status: 200 }
  );
}

function isCreatePricePayload(value: unknown): value is {
  product_id: string;
  amount_cents: number;
  billing_interval: 'monthly' | 'yearly';
  currency?: string;
  stripe_price_id?: string | null;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Record<string, unknown>;
  const validBilling = payload.billing_interval === 'monthly' || payload.billing_interval === 'yearly';
  return (
    typeof payload.product_id === 'string'
    && typeof payload.amount_cents === 'number'
    && Number.isFinite(payload.amount_cents)
    && payload.amount_cents > 0
    && validBilling
  );
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

  if (!isCreatePricePayload(body)) {
    return NextResponse.json({ success: false, message: 'Invalid price payload.' }, { status: 400 });
  }

  const result = await getSupabaseClient().db.insertPrice({
    product_id: body.product_id,
    amount_cents: body.amount_cents,
    billing_interval: body.billing_interval,
    currency: body.currency ?? 'USD',
    stripe_price_id: body.stripe_price_id ?? null,
    active: true,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ success: false, message: 'Could not create price' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
