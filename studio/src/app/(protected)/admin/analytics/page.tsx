'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AnalyticsKpiResponse,
  DatePreset,
  fetchAnalyticsKpis,
  fetchFounderScores,
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
  validation: {
    participationPerEvent: Array<{ eventId: string; eventName: string; date: string; founderPitches: number; averageScore: number }>;
    ratingDistribution: Array<{ range: string; count: number }>;
    averageRating: number;
    totalValidationResponses: number;
  };
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
        const [kpis, founderScores, validation] = await Promise.all([
          fetchAnalyticsKpis(range),
          fetchFounderScores(range),
          fetchValidationMetrics(range),
        ]);

        if (!isMounted) {
          return;
        }

        setState({ kpis, founderScores, validation });
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

  const kpis = state?.kpis ?? EMPTY_KPIS;
  const histogram = state?.founderScores.histogram ?? [];
  const trendPoints = state?.founderScores.trends ?? [];
  const validationPoints = state?.validation.participationPerEvent ?? [];

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

  const hasChartData = histogram.length > 0 || trendPoints.length > 0 || validationPoints.length > 0;

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
        </div>
      </div>

      {isLoading ? <p>Loading analytics dashboard...</p> : null}
      {error ? <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p> : null}

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

          <p style={{ margin: 0, color: '#555' }}>Average validation rating: {toPercent((state?.validation.averageRating ?? 0) / 100)}</p>
        </div>
      ) : null}
    </section>
  );
}
