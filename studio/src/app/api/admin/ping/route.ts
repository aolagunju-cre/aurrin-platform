import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/admin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        user_id: authResult.userId,
      },
    },
    { status: 200 }
  );
}
