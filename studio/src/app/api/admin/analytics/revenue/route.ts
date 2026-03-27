import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoAnalytics, demoSubscriptions } from '@/src/lib/demo/data';
import { getRevenueChurnAggregates } from '../../../../../lib/analytics/queries';
import { requireAdmin } from '../../../../../lib/auth/admin';

function parseDateRange(searchParams: URLSearchParams): { startDate?: string; endDate?: string } {
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  return { startDate, endDate };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json(
      {
        success: true,
        data: {
          mrr: demoAnalytics.total_revenue_cents,
          mrrTrend: [{ month: '2026-03', revenue: demoAnalytics.total_revenue_cents }],
          churnRate: 0.04,
          churnRateByMonth: [{ month: '2026-03', rate: 0.04 }],
          subscriptionTotals: {
            active: demoAnalytics.active_subscribers,
            cancelled: 2,
            total: demoAnalytics.active_subscribers + 2,
          },
        },
      },
      { status: 200 }
    );
  }

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
