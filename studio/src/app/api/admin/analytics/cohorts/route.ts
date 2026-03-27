import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoEvents } from '@/src/lib/demo/data';
import { getCohortAggregates } from '../../../../../lib/analytics/queries';
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
        data: demoEvents.map((e) => ({
          eventId: e.id,
          eventName: e.name,
          founderCount: e.founders_count,
          judgeCount: e.judges_count,
          date: e.start_date,
        })),
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
    const cohorts = await getCohortAggregates({ startDate, endDate });
    return NextResponse.json(
      {
        success: true,
        data: cohorts,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load cohort analytics.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
