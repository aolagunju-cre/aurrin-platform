import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminAnalyticsPage from '../src/app/(protected)/admin/analytics/page';

describe('AdminAnalyticsPage core', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders KPI cards and chart bins, and refetches with updated date preset params', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const okResponse = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

      if (url.startsWith('/api/admin/analytics/kpis')) {
        return okResponse({
          totalEvents: 4,
          totalFounders: 10,
          totalJudges: 2,
          totalScoresSubmitted: 8,
          totalValidationResponses: 100,
          activeSubscriptions: 5,
          mrr: 123400,
        });
      }

      if (url.startsWith('/api/admin/analytics/founder-scores')) {
        return okResponse({
          histogram: [
            { range: '0-20', count: 1 },
            { range: '20-40', count: 2 },
            { range: '40-60', count: 3 },
            { range: '60-80', count: 4 },
            { range: '80-100', count: 5 },
          ],
          trends: [
            { eventId: 'evt-1', eventName: 'Jan Pitch Night', date: '2026-01-15T00:00:00.000Z', averageScore: 72 },
          ],
        });
      }

      if (url.startsWith('/api/admin/analytics/validation')) {
        return okResponse({
          participationPerEvent: [
            {
              eventId: 'evt-1',
              eventName: 'Jan Pitch Night',
              date: '2026-01-15T00:00:00.000Z',
              founderPitches: 4,
              averageScore: 72,
            },
          ],
          ratingDistribution: [{ range: '60-80', count: 1 }],
          averageRating: 75,
          totalValidationResponses: 100,
        });
      }

      if (url.startsWith('/api/admin/analytics/mentoring')) {
        return okResponse({
          matchAcceptanceRate: 0.5,
          matchAcceptanceRatePercent: 50,
        });
      }

      if (url.startsWith('/api/admin/analytics/revenue')) {
        return okResponse({
          mrr: 123400,
          mrrTrend: [{ month: '2026-01', amountCents: 100000 }],
          churnRate: 0.2,
          churnRateByMonth: [{ month: '2026-01', amountCents: 2 }],
          subscriptionTotals: { active: 5, cancelled: 1, total: 6 },
        });
      }

      if (url.startsWith('/api/admin/analytics/cohorts')) {
        return okResponse({
          byFounderStage: [{ value: 'seed', count: 2, averageScore: 71, averageValidationRating: 78 }],
          byIndustry: [{ value: 'fintech', count: 2, averageScore: 71, averageValidationRating: 78 }],
          byEventCohort: [
            {
              eventId: 'evt-1',
              eventName: 'Jan Pitch Night',
              date: '2026-01-15T00:00:00.000Z',
              count: 2,
              averageScore: 71,
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

    expect(screen.getByText('Loading analytics dashboard...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total events')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('MRR')).toBeInTheDocument();
      expect(screen.getByText('$1,234')).toBeInTheDocument();
      expect(screen.getByLabelText('Histogram bin 0-20')).toBeInTheDocument();
      expect(screen.getByLabelText('Histogram bin 80-100')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'year' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/kpis?startDate=2025-03-01&endDate=2026-03-01');
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/founder-scores?startDate=2025-03-01&endDate=2026-03-01');
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/validation?startDate=2025-03-01&endDate=2026-03-01');
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/mentoring?startDate=2025-03-01&endDate=2026-03-01');
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/revenue?startDate=2025-03-01&endDate=2026-03-01');
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/cohorts?startDate=2025-03-01&endDate=2026-03-01');
    });
  });

  it('renders error state for failed KPI fetch', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith('/api/admin/analytics/kpis')) {
        return { ok: false, json: async () => ({ success: false, message: 'kpis failed' }) };
      }
      return { ok: true, json: async () => ({ success: true, data: {} }) };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<AdminAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('kpis failed');
    });
  });

  it('renders empty state when chart endpoints return no rows', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith('/api/admin/analytics/kpis')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              totalEvents: 0,
              totalFounders: 0,
              totalJudges: 0,
              totalScoresSubmitted: 0,
              totalValidationResponses: 0,
              activeSubscriptions: 0,
              mrr: 0,
            },
          }),
        };
      }
      if (url.startsWith('/api/admin/analytics/founder-scores')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { histogram: [], trends: [] } }),
        };
      }
      if (url.startsWith('/api/admin/analytics/mentoring')) {
        return { ok: true, json: async () => ({ success: true, data: { matchAcceptanceRate: 0, matchAcceptanceRatePercent: 0 } }) };
      }
      if (url.startsWith('/api/admin/analytics/revenue')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              mrr: 0,
              mrrTrend: [],
              churnRate: 0,
              churnRateByMonth: [],
              subscriptionTotals: { active: 0, cancelled: 0, total: 0 },
            },
          }),
        };
      }
      if (url.startsWith('/api/admin/analytics/cohorts')) {
        return { ok: true, json: async () => ({ success: true, data: { byFounderStage: [], byIndustry: [], byEventCohort: [] } }) };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { participationPerEvent: [], ratingDistribution: [], averageRating: 0, totalValidationResponses: 0 },
        }),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<AdminAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('No chart data for selected date range.')).toBeInTheDocument();
    });
  });
});
