import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminAnalyticsPage from '../src/app/(protected)/admin/analytics/page';

describe('AdminAnalyticsPage export controls', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls analytics export endpoint with CSV and JSON type query parameters', async () => {
    const blob = new Blob(['a,b'], { type: 'text/csv' });
    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const anchorRemove = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return {
          href: '',
          download: '',
          click: anchorClick,
          remove: anchorRemove,
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    Object.assign(URL, {
      createObjectURL: jest.fn(() => 'blob:analytics'),
      revokeObjectURL: jest.fn(),
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const okJson = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

      if (url.startsWith('/api/admin/analytics/export?')) {
        return {
          ok: true,
          headers: {
            get: () => 'attachment; filename="analytics-export-2026-03-01.csv"',
          },
          blob: async () => blob,
        };
      }

      if (url.startsWith('/api/admin/analytics/kpis')) {
        return okJson({
          totalEvents: 1,
          totalFounders: 1,
          totalJudges: 1,
          totalScoresSubmitted: 1,
          totalValidationResponses: 1,
          activeSubscriptions: 1,
          mrr: 100,
        });
      }
      if (url.startsWith('/api/admin/analytics/founder-scores')) {
        return okJson({ histogram: [], trends: [] });
      }
      if (url.startsWith('/api/admin/analytics/validation')) {
        return okJson({ participationPerEvent: [], ratingDistribution: [], averageRating: 0, totalValidationResponses: 0 });
      }
      if (url.startsWith('/api/admin/analytics/mentoring')) {
        return okJson({ matchAcceptanceRate: 0, matchAcceptanceRatePercent: 0 });
      }
      if (url.startsWith('/api/admin/analytics/revenue')) {
        return okJson({
          mrr: 100,
          mrrTrend: [],
          churnRate: 0,
          churnRateByMonth: [],
          subscriptionTotals: { active: 1, cancelled: 0, total: 1 },
        });
      }
      if (url.startsWith('/api/admin/analytics/cohorts')) {
        return okJson({ byFounderStage: [], byIndustry: [], byEventCohort: [] });
      }
      return { ok: false, json: async () => ({ success: false, message: `Unhandled ${url}` }) };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<AdminAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Export Report')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/export?type=csv&startDate=2026-01-30&endDate=2026-03-01');
      expect(screen.getByRole('button', { name: 'CSV' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/analytics/export?type=json&startDate=2026-01-30&endDate=2026-03-01');
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('shows loading and error state when export fails', async () => {
    let releaseExport: (() => void) | null = null;
    const pendingExport = new Promise<void>((resolve) => {
      releaseExport = resolve;
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const okJson = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

      if (url.startsWith('/api/admin/analytics/export?type=csv')) {
        await pendingExport;
        return {
          ok: false,
          json: async () => ({ success: false, message: 'CSV export unavailable' }),
        };
      }

      if (url.startsWith('/api/admin/analytics/kpis')) {
        return okJson({
          totalEvents: 1,
          totalFounders: 1,
          totalJudges: 1,
          totalScoresSubmitted: 1,
          totalValidationResponses: 1,
          activeSubscriptions: 1,
          mrr: 100,
        });
      }
      if (url.startsWith('/api/admin/analytics/founder-scores')) return okJson({ histogram: [], trends: [] });
      if (url.startsWith('/api/admin/analytics/validation')) return okJson({ participationPerEvent: [], ratingDistribution: [], averageRating: 0, totalValidationResponses: 0 });
      if (url.startsWith('/api/admin/analytics/mentoring')) return okJson({ matchAcceptanceRate: 0, matchAcceptanceRatePercent: 0 });
      if (url.startsWith('/api/admin/analytics/revenue')) {
        return okJson({
          mrr: 100,
          mrrTrend: [],
          churnRate: 0,
          churnRateByMonth: [],
          subscriptionTotals: { active: 1, cancelled: 0, total: 1 },
        });
      }
      if (url.startsWith('/api/admin/analytics/cohorts')) return okJson({ byFounderStage: [], byIndustry: [], byEventCohort: [] });

      return { ok: false, json: async () => ({ success: false, message: `Unhandled ${url}` }) };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<AdminAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exporting CSV...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'JSON' })).toBeDisabled();
    });

    releaseExport?.();

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('CSV export unavailable');
    });
  });
});
