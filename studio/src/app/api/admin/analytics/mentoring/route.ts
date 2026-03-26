import { NextRequest, NextResponse } from 'next/server';
import { getKpiBaseAggregates } from '../../../../../lib/analytics/queries';
import { requireAdmin } from '../../../../../lib/auth/admin';

function parseDateRange(searchParams: URLSearchParams): { startDate?: string; endDate?: string } {
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  return { startDate, endDate };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { startDate, endDate } = parseDateRange(request.nextUrl.searchParams);

  try {
    const aggregates = await getKpiBaseAggregates({ startDate, endDate });
    return NextResponse.json(
      {
        success: true,
        data: {
          matchAcceptanceRate: aggregates.matchSuccessRate,
          matchAcceptanceRatePercent: Number((aggregates.matchSuccessRate * 100).toFixed(2)),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load mentoring analytics.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
