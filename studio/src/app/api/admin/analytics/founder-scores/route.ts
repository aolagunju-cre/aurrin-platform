import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoAnalytics, demoEvents } from '@/src/lib/demo/data';
import { getEventTimeSeries, getScoreDistribution } from '../../../../../lib/analytics/queries';
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
          histogram: [
            { range: '0-20', count: 2 },
            { range: '21-40', count: 5 },
            { range: '41-60', count: 12 },
            { range: '61-80', count: 28 },
            { range: '81-100', count: 15 },
          ],
          trends: demoEvents.map((e) => ({
            eventId: e.id,
            eventName: e.name,
            date: e.start_date,
            averageScore: demoAnalytics.avg_score,
          })),
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
