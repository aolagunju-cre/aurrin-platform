import { NextRequest, NextResponse } from 'next/server';
import {
  getCohortAggregates,
  getEventTimeSeries,
  getKpiBaseAggregates,
  getRevenueChurnAggregates,
  getScoreDistribution,
} from '../../../../../lib/analytics/queries';
import { buildAnalyticsExportData, serializeAnalyticsExportCsv } from '../../../../../lib/analytics/export';
import { requireAdmin } from '../../../../../lib/auth/admin';

type ExportType = 'csv' | 'json';

function parseDateRange(searchParams: URLSearchParams): { startDate?: string; endDate?: string } {
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  return { startDate, endDate };
}

function parseExportType(searchParams: URLSearchParams): ExportType | null {
  const type = searchParams.get('type');
  if (type === 'csv' || type === 'json') {
    return type;
  }
  return null;
}

function buildExportFilename(type: ExportType, exportedAt: string): string {
  const safeTimestamp = exportedAt.replace(/[.:]/g, '-');
  return `analytics-export-${safeTimestamp}.${type}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const type = parseExportType(request.nextUrl.searchParams);
  if (!type) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid export type. Supported values: csv, json.',
      },
      { status: 400 }
    );
  }

  const { startDate, endDate } = parseDateRange(request.nextUrl.searchParams);
  const exportedAt = new Date().toISOString();

  try {
    const [kpis, scoreDistribution, eventTimeSeries, cohorts, revenueChurn] = await Promise.all([
      getKpiBaseAggregates({ startDate, endDate }),
      getScoreDistribution({ startDate, endDate }),
      getEventTimeSeries({ startDate, endDate }),
      getCohortAggregates({ startDate, endDate }),
      getRevenueChurnAggregates({ startDate, endDate }),
    ]);

    const exportData = buildAnalyticsExportData({
      kpis,
      scoreDistribution,
      eventTimeSeries,
      cohorts,
      revenueChurn,
    });

    const filename = buildExportFilename(type, exportedAt);

    if (type === 'json') {
      return NextResponse.json(
        {
          success: true,
          exportedAt,
          data: exportData,
        },
        {
          status: 200,
          headers: {
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        }
      );
    }

    const csv = serializeAnalyticsExportCsv(exportData);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not export analytics report.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
