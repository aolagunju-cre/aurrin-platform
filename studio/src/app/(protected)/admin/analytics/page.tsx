'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Analytics Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="date-preset">Date range</label>
          <select id="date-preset" value={preset} onChange={(event) => setPreset(event.target.value as DatePreset)}>
            <option value="last-30-days">Last 30 days</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
            <option value="all-time">All-time</option>
            <option value="custom">Custom</option>
          </select>
          {preset === 'custom' ? (
            <>
              <label htmlFor="start-date">Start</label>
              <input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
              />
              <label htmlFor="end-date">End</label>
              <input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
              />
            </>
          ) : null}
          <span style={{ marginLeft: '0.5rem' }}>Export Report</span>
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={exportingType !== null}
          >
            {exportingType === 'csv' ? 'Exporting CSV...' : 'CSV'}
          </button>
          <button
            type="button"
            onClick={() => void handleExport('json')}
            disabled={exportingType !== null}
          >
            {exportingType === 'json' ? 'Exporting JSON...' : 'JSON'}
          </button>
        </div>
      </div>

      {isLoading ? <p>Loading analytics dashboard...</p> : null}
      {error ? <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p> : null}
      {exportError ? <p role="status" style={{ color: '#b00020', margin: 0 }}>{exportError}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Total events</h2><p style={{ margin: 0 }}>{kpis.totalEvents}</p></article>
        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Total founders</h2><p style={{ margin: 0 }}>{kpis.totalFounders}</p></article>
        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Total judges</h2><p style={{ margin: 0 }}>{kpis.totalJudges}</p></article>
        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Total scores submitted</h2><p style={{ margin: 0 }}>{kpis.totalScoresSubmitted}</p></article>
        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Total validation responses</h2><p style={{ margin: 0 }}>{kpis.totalValidationResponses}</p></article>
        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Active subscriptions</h2><p style={{ margin: 0 }}>{kpis.activeSubscriptions}</p></article>
        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>MRR</h2><p style={{ margin: 0 }}>{formatUsd(kpis.mrr)}</p></article>
      </div>

      {!isLoading && !error && !hasChartData ? <p>No chart data for selected date range.</p> : null}

      {!isLoading && !error && hasChartData ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
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

          <p style={{ margin: 0, color: '#555' }}>Average validation rating: {toPercent((state?.validation.averageRating ?? 0) / 100)}</p>
        </div>
      ) : null}

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Cohort analysis</h2>

        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}>
          <h3 style={{ marginTop: 0 }}>Founders by stage</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Stage</th>
                <th align="left">Count</th>
                <th align="left">Avg score</th>
                <th align="left">Validation rating</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.byFounderStage.map((row) => (
                <tr key={`stage-${row.value}`}>
                  <td>{row.value}</td>
                  <td>{row.count}</td>
                  <td>{row.averageScore.toFixed(1)}</td>
                  <td>{row.averageValidationRating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}>
          <h3 style={{ marginTop: 0 }}>Founders by industry</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Industry</th>
                <th align="left">Count</th>
                <th align="left">Avg score</th>
                <th align="left">Validation rating</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.byIndustry.map((row) => (
                <tr key={`industry-${row.value}`}>
                  <td>{row.value}</td>
                  <td>{row.count}</td>
                  <td>{row.averageScore.toFixed(1)}</td>
                  <td>{row.averageValidationRating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}>
          <h3 style={{ marginTop: 0 }}>Founders by cohort (event)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Event</th>
                <th align="left">Count</th>
                <th align="left">Avg score</th>
                <th align="left">% matched with mentors</th>
                <th align="left">Retention to next event</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.byEventCohort.map((row) => (
                <tr key={`event-${row.eventId}`}>
                  <td>{row.eventName}</td>
                  <td>{row.count}</td>
                  <td>{row.averageScore.toFixed(1)}</td>
                  <td>{toPercent(row.matchedWithMentorsRate)}</td>
                  <td>{toPercent(row.retentionToNextEventRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </section>
  );
}
