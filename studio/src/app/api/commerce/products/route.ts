import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';
import { requireAdmin } from '../../../../lib/auth/admin';

export async function GET(): Promise<NextResponse> {
  const client = getSupabaseClient();
  const result = await client.db.listProducts(true);

  if (result.error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Could not load products',
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

function isCreatePayload(value: unknown): value is {
  name: string;
  description?: string | null;
  stripe_product_id?: string | null;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return typeof payload.name === 'string' && payload.name.trim().length > 0;
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

  if (!isCreatePayload(body)) {
    return NextResponse.json({ success: false, message: 'name is required.' }, { status: 400 });
  }

  const result = await getSupabaseClient().db.insertProduct({
    name: body.name.trim(),
    description: body.description ?? null,
    stripe_product_id: body.stripe_product_id ?? null,
    active: true,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ success: false, message: 'Could not create product' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
