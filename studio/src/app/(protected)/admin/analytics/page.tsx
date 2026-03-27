'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';
import {
  AnalyticsKpiResponse,
  CohortResponse,
  DatePreset,
  MentoringResponse,
  RevenueResponse,
  ValidationResponse,
  fetchAnalyticsExport,
  fetchAnalyticsKpis,
  fetchCohortMetrics,
  fetchFounderScores,
  fetchMentoringMetrics,
  fetchRevenueMetrics,
  fetchValidationMetrics,
  rangeFromPreset,
} from '../../../../lib/admin/analytics-client';
import { HistogramChart } from '../../../../components/admin/charts/HistogramChart';
import { LineTrendChart } from '../../../../components/admin/charts/LineTrendChart';

interface AnalyticsState {
  kpis: AnalyticsKpiResponse;
  founderScores: {
    histogram: Array<{ range: string; count: number }>;
    trends: Array<{ eventId: string; eventName: string; date: string; averageScore: number }>;
  };
  validation: ValidationResponse;
  mentoring: MentoringResponse;
  revenue: RevenueResponse;
  cohorts: CohortResponse;
}

const EMPTY_KPIS: AnalyticsKpiResponse = {
  totalEvents: 0,
  totalFounders: 0,
  totalJudges: 0,
  totalScoresSubmitted: 0,
  totalValidationResponses: 0,
  activeSubscriptions: 0,
  mrr: 0,
};

const EMPTY_COHORTS: CohortResponse = {
  byFounderStage: [],
  byIndustry: [],
  byEventCohort: [],
};

function toPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AdminAnalyticsPage(): React.ReactElement {
  const [preset, setPreset] = useState<DatePreset>('last-30-days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<AnalyticsState | null>(null);
  const [exportingType, setExportingType] = useState<'csv' | 'json' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === 'custom') {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    return rangeFromPreset(preset);
  }, [preset, customStartDate, customEndDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadAnalytics(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const [kpis, founderScores, validation, mentoring, revenue, cohorts] = await Promise.all([
          fetchAnalyticsKpis(range),
          fetchFounderScores(range),
          fetchValidationMetrics(range),
          fetchMentoringMetrics(range),
          fetchRevenueMetrics(range),
          fetchCohortMetrics(range),
        ]);

        if (!isMounted) {
          return;
        }

        setState({ kpis, founderScores, validation, mentoring, revenue, cohorts });
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics dashboard.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [range]);

  async function handleExport(type: 'csv' | 'json'): Promise<void> {
    setExportingType(type);
    setExportError(null);
    try {
      const { blob, filename } = await fetchAnalyticsExport(type, range);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setExportError(requestError instanceof Error ? requestError.message : 'Failed to export analytics report.');
    } finally {
      setExportingType(null);
    }
  }

  const kpis = state?.kpis ?? EMPTY_KPIS;
  const histogram = state?.founderScores.histogram ?? [];
  const trendPoints = state?.founderScores.trends ?? [];
  const validationPoints = state?.validation.participationPerEvent ?? [];
  const ratingDistribution = state?.validation.ratingDistribution ?? [];
  const cohorts = state?.cohorts ?? EMPTY_COHORTS;
  const mrrTrend = state?.revenue.mrrTrend ?? [];
  const churnByMonth = state?.revenue.churnRateByMonth ?? [];
  const cohortRetentionPoints = cohorts.byEventCohort;

  const judgeEngagementPoints = validationPoints.map((point) => {
    const expectedScoreSubmissions = Math.max(1, point.founderPitches * Math.max(1, kpis.totalJudges));
    const engagement = Math.min(1, kpis.totalScoresSubmitted / expectedScoreSubmissions);
    return {
      id: `judge-${point.eventId}`,
      label: point.eventName,
      date: point.date.slice(0, 10),
      value: engagement,
    };
  });

  const validationParticipationPoints = validationPoints.map((point) => ({
    id: `validation-${point.eventId}`,
    label: point.eventName,
    date: point.date.slice(0, 10),
    value: Math.max(0, Math.min(1, point.founderPitches === 0 ? 0 : kpis.totalValidationResponses / (point.founderPitches * 100))),
  }));

  const mrrDenominator = Math.max(1, ...mrrTrend.map((point) => point.amountCents));
  const mrrPoints = mrrTrend.map((point) => ({
    id: `mrr-${point.month}`,
    label: point.month,
    date: point.month,
    value: Math.max(0, Math.min(1, point.amountCents / mrrDenominator)),
  }));

  const churnDenominator = Math.max(1, ...churnByMonth.map((point) => point.amountCents));
  const churnPoints = churnByMonth.map((point) => ({
    id: `churn-${point.month}`,
    label: point.month,
    date: point.month,
    value: Math.max(0, Math.min(1, point.amountCents / churnDenominator)),
  }));

  const mentorAcceptancePoints = [
    {
      id: 'mentor-acceptance',
      label: 'All selected events',
      date: range.endDate ?? 'current',
      value: Math.max(0, Math.min(1, state?.mentoring.matchAcceptanceRate ?? 0)),
    },
  ];

  const retentionPoints = cohortRetentionPoints.map((point) => ({
    id: `retention-${point.eventId}`,
    label: point.eventName,
    date: point.date.slice(0, 10),
    value: Math.max(0, Math.min(1, point.retentionToNextEventRate)),
  }));

  const hasChartData =
    histogram.length > 0 ||
    trendPoints.length > 0 ||
    validationPoints.length > 0 ||
    ratingDistribution.length > 0 ||
    mrrPoints.length > 0 ||
    churnPoints.length > 0 ||
    retentionPoints.length > 0;

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="date-preset" className="text-sm text-default-500">Date range</label>
          <select id="date-preset" value={preset} onChange={(event) => setPreset(event.target.value as DatePreset)} className="rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="last-30-days">Last 30 days</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
            <option value="all-time">All-time</option>
            <option value="custom">Custom</option>
          </select>
          {preset === 'custom' ? (
            <>
              <label htmlFor="start-date" className="text-sm text-default-500">Start</label>
              <input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
                className="rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <label htmlFor="end-date" className="text-sm text-default-500">End</label>
              <input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </>
          ) : null}
          <span className="text-sm text-default-500 ml-2">Export Report</span>
          <Button
            size="sm"
            color="secondary"
            variant="flat"
            onPress={() => void handleExport('csv')}
            isDisabled={exportingType !== null}
          >
            {exportingType === 'csv' ? 'Exporting CSV...' : 'CSV'}
          </Button>
          <Button
            size="sm"
            color="secondary"
            variant="flat"
            onPress={() => void handleExport('json')}
            isDisabled={exportingType !== null}
          >
            {exportingType === 'json' ? 'Exporting JSON...' : 'JSON'}
          </Button>
        </div>
      </div>

      {isLoading ? <p className="text-default-400">Loading analytics dashboard...</p> : null}
      {error ? <p role="alert" className="text-danger">{error}</p> : null}
      {exportError ? <p role="status" className="text-danger">{exportError}</p> : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Total events', value: kpis.totalEvents },
          { label: 'Total founders', value: kpis.totalFounders },
          { label: 'Total judges', value: kpis.totalJudges },
          { label: 'Total scores submitted', value: kpis.totalScoresSubmitted },
          { label: 'Total validation responses', value: kpis.totalValidationResponses },
          { label: 'Active subscriptions', value: kpis.activeSubscriptions },
          { label: 'MRR', value: formatUsd(kpis.mrr) },
        ].map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
            <p className="text-sm text-default-500">{kpi.label}</p>
            <p className="text-3xl font-bold text-violet-400">{kpi.value}</p>
          </article>
        ))}
      </div>

      {!isLoading && !error && !hasChartData ? <p className="py-12 text-center text-default-400">No chart data for selected date range.</p> : null}

      {!isLoading && !error && hasChartData ? (
        <div className="space-y-6">
          <HistogramChart title="Founder score distribution" points={histogram} />
          <HistogramChart title="Validation response distribution" points={ratingDistribution} />

          <LineTrendChart
            title="Scores over time"
            yAxisLabel="Average score per event"
            points={trendPoints.map((point) => ({
              id: `score-${point.eventId}`,
              label: point.eventName,
              date: point.date.slice(0, 10),
              value: Math.max(0, Math.min(1, point.averageScore / 100)),
            }))}
          />

          <LineTrendChart
            title="Validation participation"
            yAxisLabel="Responses per event (normalized)"
            points={validationParticipationPoints}
          />

          <LineTrendChart
            title="Judge engagement"
            yAxisLabel="Estimated % judges who submitted scores per event"
            points={judgeEngagementPoints}
          />

          <LineTrendChart
            title="Match acceptance rate"
            yAxisLabel="% of mentor matches accepted (both parties)"
            points={mentorAcceptancePoints}
          />

          <LineTrendChart
            title="Subscription MRR trend"
            yAxisLabel="MRR over time (normalized)"
            points={mrrPoints}
          />

          <LineTrendChart
            title="Churn rate"
            yAxisLabel="Monthly cancellations (normalized)"
            points={churnPoints}
          />

          <LineTrendChart
            title="Founder retention"
            yAxisLabel="% of founders returning in a later event"
            points={retentionPoints}
          />

          <p className="text-sm text-default-400">Average validation rating: {toPercent((state?.validation.averageRating ?? 0) / 100)}</p>
        </div>
      ) : null}

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Cohort analysis</h2>

        {[
          {
            title: 'Founders by stage',
            headers: ['Stage', 'Count', 'Avg score', 'Validation rating'],
            rows: cohorts.byFounderStage,
            renderRow: (row: (typeof cohorts.byFounderStage)[number]) => (
              <tr key={`stage-${row.value}`} className="hover:bg-default-100/50 transition-colors">
                <td className="px-4 py-3 border-b border-default-100 text-foreground">{row.value}</td>
                <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.count}</td>
                <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.averageScore.toFixed(1)}</td>
                <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.averageValidationRating.toFixed(1)}</td>
              </tr>
            ),
          },
          {
            title: 'Founders by industry',
            headers: ['Industry', 'Count', 'Avg score', 'Validation rating'],
            rows: cohorts.byIndustry,
            renderRow: (row: (typeof cohorts.byIndustry)[number]) => (
              <tr key={`industry-${row.value}`} className="hover:bg-default-100/50 transition-colors">
                <td className="px-4 py-3 border-b border-default-100 text-foreground">{row.value}</td>
                <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.count}</td>
                <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.averageScore.toFixed(1)}</td>
                <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.averageValidationRating.toFixed(1)}</td>
              </tr>
            ),
          },
        ].map((section) => (
          <article key={section.title} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
            <h3 className="text-lg font-semibold text-foreground mb-3">{section.title}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {section.headers.map((header) => (
                    <th key={header} className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => section.renderRow(row))}
              </tbody>
            </table>
          </article>
        ))}

        <article className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-foreground mb-3">Founders by cohort (event)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Event</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Count</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Avg score</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">% matched with mentors</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Retention to next event</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.byEventCohort.map((row) => (
                <tr key={`event-${row.eventId}`} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100 text-foreground">{row.eventName}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.count}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{row.averageScore.toFixed(1)}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{toPercent(row.matchedWithMentorsRate)}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{toPercent(row.retentionToNextEventRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </section>
  );
}
