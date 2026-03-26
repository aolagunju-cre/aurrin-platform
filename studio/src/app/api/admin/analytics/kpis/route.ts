import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getKpiBaseAggregates } from '../../../../../lib/analytics/queries';

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
          totalEvents: aggregates.eventCount,
          totalFounders: aggregates.founderCount,
          totalJudges: aggregates.judgeCount,
          totalScoresSubmitted: aggregates.totalScores,
          totalValidationResponses: aggregates.validationResponses,
          activeSubscriptions: aggregates.activeSubscriptions,
          mrr: aggregates.revenueCents,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load analytics KPIs.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
