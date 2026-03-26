import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../lib/db/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!query) {
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }

  const client = getSupabaseClient();
  const result = await client.db.searchUsersByEmail(query, 10);
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: result.data.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
      })),
    },
    { status: 200 }
  );
}
