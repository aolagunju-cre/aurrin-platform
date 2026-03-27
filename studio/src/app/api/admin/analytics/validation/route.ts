import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoAnalytics, demoEvents } from '@/src/lib/demo/data';
import { getEventTimeSeries, getKpiBaseAggregates, getScoreDistribution } from '../../../../../lib/analytics/queries';
import { requireAdmin } from '../../../../../lib/auth/admin';

function parseDateRange(searchParams: URLSearchParams): { startDate?: string; endDate?: string } {
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  return { startDate, endDate };
}

function midpoint(label: string): number {
  const [min, max] = label.split('-').map((value) => Number(value));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  return (min + max) / 2;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json(
      {
        success: true,
        data: {
          participationPerEvent: demoEvents.map((e) => ({
            eventId: e.id,
            eventName: e.name,
            date: e.start_date,
            founderPitches: e.founders_count,
            averageScore: demoAnalytics.avg_score,
          })),
          ratingDistribution: [
            { range: '0-20', count: 2 },
            { range: '21-40', count: 5 },
            { range: '41-60', count: 12 },
            { range: '61-80', count: 28 },
            { range: '81-100', count: 15 },
          ],
          averageRating: demoAnalytics.avg_score,
          totalValidationResponses: demoAnalytics.total_audience_sessions,
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
    const [kpis, trends, scoreDistribution] = await Promise.all([
      getKpiBaseAggregates({ startDate, endDate }),
      getEventTimeSeries({ startDate, endDate }),
      getScoreDistribution({ startDate, endDate }),
    ]);

    const totalRatings = scoreDistribution.reduce((sum, bin) => sum + bin.count, 0);
    const weightedRatingTotal = scoreDistribution.reduce((sum, bin) => sum + midpoint(bin.label) * bin.count, 0);
    const averageRating = totalRatings === 0 ? 0 : weightedRatingTotal / totalRatings;

    return NextResponse.json(
      {
        success: true,
        data: {
          participationPerEvent: trends.map((point) => ({
            eventId: point.eventId,
            eventName: point.eventName,
            date: point.date,
            founderPitches: point.pitchCount,
            averageScore: point.averageScore,
          })),
          ratingDistribution: scoreDistribution.map((bin) => ({
            range: bin.label,
            count: bin.count,
          })),
          averageRating,
          totalValidationResponses: kpis.validationResponses,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load validation analytics.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
