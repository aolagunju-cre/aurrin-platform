import { NextRequest, NextResponse } from 'next/server';
import { getEventTimeSeries, getScoreDistribution } from '../../../../../lib/analytics/queries';
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
    const [histogram, trends] = await Promise.all([
      getScoreDistribution({ startDate, endDate }),
      getEventTimeSeries({ startDate, endDate }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          histogram: histogram.map((bin) => ({ range: bin.label, count: bin.count })),
          trends: trends.map((point) => ({
            eventId: point.eventId,
            eventName: point.eventName,
            date: point.date,
            averageScore: point.averageScore,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load founder score analytics.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
