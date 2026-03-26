import { NextRequest, NextResponse } from 'next/server';
import { getRevenueChurnAggregates } from '../../../../../lib/analytics/queries';
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
    const aggregates = await getRevenueChurnAggregates({ startDate, endDate });

    return NextResponse.json(
      {
        success: true,
        data: {
          mrr: aggregates.mrrCents,
          mrrTrend: aggregates.revenueByMonth,
          churnRate: aggregates.churnRate,
          churnRateByMonth: aggregates.churnByMonth,
          subscriptionTotals: {
            active: aggregates.activeSubscriptions,
            cancelled: aggregates.cancelledSubscriptions,
            total: aggregates.activeSubscriptions + aggregates.cancelledSubscriptions,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load revenue analytics.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
