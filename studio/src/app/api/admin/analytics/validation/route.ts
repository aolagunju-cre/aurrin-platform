import { NextRequest, NextResponse } from 'next/server';
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
