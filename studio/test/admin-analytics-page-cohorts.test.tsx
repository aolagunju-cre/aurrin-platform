import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminAnalyticsPage from '../src/app/(protected)/admin/analytics/page';

describe('AdminAnalyticsPage cohorts and advanced analytics sections', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders advanced charts and cohort tables with required metrics', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const okResponse = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

      if (url.startsWith('/api/admin/analytics/kpis')) {
        return okResponse({
          totalEvents: 2,
          totalFounders: 8,
          totalJudges: 3,
          totalScoresSubmitted: 18,
          totalValidationResponses: 90,
          activeSubscriptions: 4,
          mrr: 102000,
        });
      }
      if (url.startsWith('/api/admin/analytics/founder-scores')) {
        return okResponse({
          histogram: [
            { range: '0-20', count: 0 },
            { range: '20-40', count: 1 },
            { range: '40-60', count: 2 },
            { range: '60-80', count: 3 },
            { range: '80-100', count: 2 },
          ],
          trends: [{ eventId: 'evt-1', eventName: 'Jan Demo Day', date: '2026-01-20T00:00:00.000Z', averageScore: 74 }],
        });
      }
      if (url.startsWith('/api/admin/analytics/validation')) {
        return okResponse({
          participationPerEvent: [{ eventId: 'evt-1', eventName: 'Jan Demo Day', date: '2026-01-20T00:00:00.000Z', founderPitches: 4, averageScore: 74 }],
          ratingDistribution: [{ range: '60-80', count: 8 }],
          averageRating: 78,
          totalValidationResponses: 90,
        });
      }
      if (url.startsWith('/api/admin/analytics/mentoring')) {
        return okResponse({ matchAcceptanceRate: 0.5, matchAcceptanceRatePercent: 50 });
      }
      if (url.startsWith('/api/admin/analytics/revenue')) {
        return okResponse({
          mrr: 102000,
          mrrTrend: [{ month: '2026-01', amountCents: 90000 }, { month: '2026-02', amountCents: 102000 }],
          churnRate: 0.25,
          churnRateByMonth: [{ month: '2026-01', amountCents: 1 }, { month: '2026-02', amountCents: 2 }],
          subscriptionTotals: { active: 4, cancelled: 2, total: 6 },
        });
      }
      if (url.startsWith('/api/admin/analytics/cohorts')) {
        return okResponse({
          byFounderStage: [{ value: 'seed', count: 5, averageScore: 74, averageValidationRating: 79 }],
          byIndustry: [{ value: 'fintech', count: 4, averageScore: 72, averageValidationRating: 76 }],
          byEventCohort: [
            {
              eventId: 'evt-1',
              eventName: 'Jan Demo Day',
              date: '2026-01-20T00:00:00.000Z',
              count: 4,
              averageScore: 74,
              matchedWithMentorsRate: 0.5,
              retentionToNextEventRate: 0.25,
            },
          ],
        });
      }

      return { ok: false, json: async () => ({ success: false, message: `Unhandled ${url}` }) };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<AdminAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Validation response distribution')).toBeInTheDocument();
      expect(screen.getByText('Match acceptance rate')).toBeInTheDocument();
      expect(screen.getByText('Subscription MRR trend')).toBeInTheDocument();
      expect(screen.getByText('Churn rate')).toBeInTheDocument();
      expect(screen.getByText('Founder retention')).toBeInTheDocument();
      expect(screen.getByText('Cohort analysis')).toBeInTheDocument();
      expect(screen.getByText('Founders by stage')).toBeInTheDocument();
      expect(screen.getByText('Founders by industry')).toBeInTheDocument();
      expect(screen.getByText('Founders by cohort (event)')).toBeInTheDocument();
      expect(screen.getByText('seed')).toBeInTheDocument();
      expect(screen.getByText('fintech')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });
});
