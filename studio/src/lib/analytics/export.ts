import type {
  CohortAggregates,
  EventTimeSeriesPoint,
  KpiAggregates,
  RevenueChurnAggregates,
  ScoreDistributionBin,
} from './queries';

export interface AnalyticsExportData {
  events: {
    totalEvents: number;
    timeSeries: EventTimeSeriesPoint[];
  };
  founders: {
    totalFounders: number;
    byStage: CohortAggregates['byFounderStage'];
    byIndustry: CohortAggregates['byIndustry'];
    byEventCohort: CohortAggregates['byEventCohort'];
  };
  scores: {
    totalScoresSubmitted: number;
    distribution: ScoreDistributionBin[];
    trends: EventTimeSeriesPoint[];
  };
  validation: {
    totalResponses: number;
    participationByEvent: EventTimeSeriesPoint[];
  };
  subscriptions: {
    active: number;
    cancelled: number;
    total: number;
    churnRate: number;
    churnByMonth: RevenueChurnAggregates['churnByMonth'];
  };
  revenue: {
    totalRevenueCents: number;
    mrrCents: number;
    byMonth: RevenueChurnAggregates['revenueByMonth'];
  };
}

export function buildAnalyticsExportData(params: {
  kpis: KpiAggregates;
  scoreDistribution: ScoreDistributionBin[];
  eventTimeSeries: EventTimeSeriesPoint[];
  cohorts: CohortAggregates;
  revenueChurn: RevenueChurnAggregates;
}): AnalyticsExportData {
  const { kpis, scoreDistribution, eventTimeSeries, cohorts, revenueChurn } = params;

  return {
    events: {
      totalEvents: kpis.eventCount,
      timeSeries: [...eventTimeSeries],
    },
    founders: {
      totalFounders: kpis.founderCount,
      byStage: [...cohorts.byFounderStage],
      byIndustry: [...cohorts.byIndustry],
      byEventCohort: [...cohorts.byEventCohort],
    },
    scores: {
      totalScoresSubmitted: kpis.totalScores,
      distribution: [...scoreDistribution],
      trends: [...eventTimeSeries],
    },
    validation: {
      totalResponses: kpis.validationResponses,
      participationByEvent: [...eventTimeSeries],
    },
    subscriptions: {
      active: revenueChurn.activeSubscriptions,
      cancelled: revenueChurn.cancelledSubscriptions,
      total: revenueChurn.activeSubscriptions + revenueChurn.cancelledSubscriptions,
      churnRate: revenueChurn.churnRate,
      churnByMonth: [...revenueChurn.churnByMonth],
    },
    revenue: {
      totalRevenueCents: revenueChurn.totalRevenueCents,
      mrrCents: revenueChurn.mrrCents,
      byMonth: [...revenueChurn.revenueByMonth],
    },
  };
}

function escapeCsvCell(value: string | number): string {
  const cell = String(value);
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function serializeAnalyticsExportCsv(data: AnalyticsExportData): string {
  const columns = [
    'section',
    'metric',
    'date',
    'eventId',
    'eventName',
    'range',
    'cohort',
    'month',
    'value',
    'count',
    'amountCents',
    'averageScore',
  ];

  const rows: Array<Record<string, string | number>> = [];

  rows.push({ section: 'events', metric: 'totalEvents', value: data.events.totalEvents });
  for (const point of data.events.timeSeries) {
    rows.push({
      section: 'events',
      metric: 'timeSeries',
      date: point.date,
      eventId: point.eventId,
      eventName: point.eventName,
      count: point.pitchCount,
      averageScore: point.averageScore,
    });
  }

  rows.push({ section: 'founders', metric: 'totalFounders', value: data.founders.totalFounders });
  for (const bucket of data.founders.byStage) {
    rows.push({ section: 'founders', metric: 'byStage', cohort: bucket.value, count: bucket.count });
  }
  for (const bucket of data.founders.byIndustry) {
    rows.push({ section: 'founders', metric: 'byIndustry', cohort: bucket.value, count: bucket.count });
  }
  for (const bucket of data.founders.byEventCohort) {
    rows.push({
      section: 'founders',
      metric: 'byEventCohort',
      eventId: bucket.eventId,
      count: bucket.count,
      averageScore: bucket.averageScore,
    });
  }

  rows.push({ section: 'scores', metric: 'totalScoresSubmitted', value: data.scores.totalScoresSubmitted });
  for (const bin of data.scores.distribution) {
    rows.push({ section: 'scores', metric: 'distribution', range: bin.label, count: bin.count });
  }
  for (const trend of data.scores.trends) {
    rows.push({
      section: 'scores',
      metric: 'trends',
      date: trend.date,
      eventId: trend.eventId,
      eventName: trend.eventName,
      averageScore: trend.averageScore,
    });
  }

  rows.push({ section: 'validation', metric: 'totalResponses', value: data.validation.totalResponses });
  for (const point of data.validation.participationByEvent) {
    rows.push({
      section: 'validation',
      metric: 'participationByEvent',
      date: point.date,
      eventId: point.eventId,
      eventName: point.eventName,
      count: point.pitchCount,
      averageScore: point.averageScore,
    });
  }

  rows.push({ section: 'subscriptions', metric: 'active', value: data.subscriptions.active });
  rows.push({ section: 'subscriptions', metric: 'cancelled', value: data.subscriptions.cancelled });
  rows.push({ section: 'subscriptions', metric: 'total', value: data.subscriptions.total });
  rows.push({ section: 'subscriptions', metric: 'churnRate', value: data.subscriptions.churnRate });
  for (const month of data.subscriptions.churnByMonth) {
    rows.push({
      section: 'subscriptions',
      metric: 'churnByMonth',
      month: month.month,
      amountCents: month.amountCents,
    });
  }

  rows.push({ section: 'revenue', metric: 'totalRevenueCents', value: data.revenue.totalRevenueCents });
  rows.push({ section: 'revenue', metric: 'mrrCents', value: data.revenue.mrrCents });
  for (const month of data.revenue.byMonth) {
    rows.push({
      section: 'revenue',
      metric: 'byMonth',
      month: month.month,
      amountCents: month.amountCents,
    });
  }

  const output = [columns.join(',')];
  for (const row of rows) {
    output.push(columns.map((column) => escapeCsvCell(row[column] ?? '')).join(','));
  }

  return output.join('\n');
}
