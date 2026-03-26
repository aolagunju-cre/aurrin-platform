import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';

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
