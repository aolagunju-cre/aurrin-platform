import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';

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
