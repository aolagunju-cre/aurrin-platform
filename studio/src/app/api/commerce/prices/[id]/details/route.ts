import { NextResponse } from 'next/server';
import { DEMO_MODE, demoProducts } from '@/src/lib/demo/data';
import { getSupabaseClient } from '../../../../../../lib/db/client';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  if (DEMO_MODE) {
    const product = demoProducts[0] ?? null;
    return NextResponse.json(
      {
        success: true,
        data: {
          price: {
            id,
            amount_cents: product?.price_cents ?? 2900,
            currency: 'USD',
            billing_interval: 'monthly',
          },
          product: product
            ? {
                id: product.id,
                name: product.name,
                description: product.description,
              }
            : null,
        },
      },
      { status: 200 }
    );
  }

  const client = getSupabaseClient();
  const priceResult = await client.db.getPriceById(id);

  if (priceResult.error) {
    return NextResponse.json({ success: false, message: 'Could not load price' }, { status: 500 });
  }
  if (!priceResult.data) {
    return NextResponse.json({ success: false, message: 'Price not found' }, { status: 404 });
  }

  const productResult = await client.db.getProductById(priceResult.data.product_id);
  if (productResult.error) {
    return NextResponse.json({ success: false, message: 'Could not load product' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        price: priceResult.data,
        product: productResult.data,
      },
    },
    { status: 200 }
  );
}
