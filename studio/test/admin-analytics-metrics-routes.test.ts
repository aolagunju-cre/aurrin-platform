/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getFounderScores } from '../src/app/api/admin/analytics/founder-scores/route';
import { GET as getMentoring } from '../src/app/api/admin/analytics/mentoring/route';
import { GET as getRevenue } from '../src/app/api/admin/analytics/revenue/route';
import { GET as getValidation } from '../src/app/api/admin/analytics/validation/route';
import { getEventTimeSeries, getKpiBaseAggregates, getRevenueChurnAggregates, getScoreDistribution } from '../src/lib/analytics/queries';
import { requireAdmin } from '../src/lib/auth/admin';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/analytics/queries', () => ({
  getKpiBaseAggregates: jest.fn(),
  getScoreDistribution: jest.fn(),
  getEventTimeSeries: jest.fn(),
  getRevenueChurnAggregates: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetKpiBaseAggregates = getKpiBaseAggregates as jest.MockedFunction<typeof getKpiBaseAggregates>;
const mockedGetScoreDistribution = getScoreDistribution as jest.MockedFunction<typeof getScoreDistribution>;
const mockedGetEventTimeSeries = getEventTimeSeries as jest.MockedFunction<typeof getEventTimeSeries>;
const mockedGetRevenueChurnAggregates = getRevenueChurnAggregates as jest.MockedFunction<typeof getRevenueChurnAggregates>;

function buildRequest(path: string): NextRequest {
  return new NextRequest(new Request(`http://localhost${path}?startDate=2026-01-01&endDate=2026-01-31`, { method: 'GET' }));
}

describe('admin analytics metrics routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedRequireAdmin.mockResolvedValue({
      userId: 'admin-1',
      auth: {
        sub: 'admin-1',
        email: 'admin@example.com',
        iat: 0,
        exp: 9999999999,
        aud: 'authenticated',
        iss: 'https://example.supabase.co/auth/v1',
      },
    });

    mockedGetKpiBaseAggregates.mockResolvedValue({
      eventCount: 2,
      founderCount: 10,
      judgeCount: 4,
      totalScores: 12,
      validationResponses: 32,
      matchSuccessRate: 0.625,
      revenueCents: 9900,
      activeSubscriptions: 7,
      subscriptionChurnRate: 0.2,
    });

    mockedGetScoreDistribution.mockResolvedValue([
      { label: '0-20', min: 0, max: 20, count: 1 },
      { label: '20-40', min: 20, max: 40, count: 2 },
      { label: '40-60', min: 40, max: 60, count: 3 },
      { label: '60-80', min: 60, max: 80, count: 4 },
      { label: '80-100', min: 80, max: 100, count: 5 },
    ]);

    mockedGetEventTimeSeries.mockResolvedValue([
      {
        date: '2026-01-10T00:00:00.000Z',
        eventId: 'event-1',
        eventName: 'January Demo Day',
        pitchCount: 6,
        averageScore: 73.5,
      },
    ]);

    mockedGetRevenueChurnAggregates.mockResolvedValue({
      totalRevenueCents: 330000,
      mrrCents: 120000,
      activeSubscriptions: 7,
      cancelledSubscriptions: 3,
      churnRate: 0.3,
      revenueByMonth: [{ month: '2026-01', amountCents: 120000 }],
      churnByMonth: [{ month: '2026-01', amountCents: 2 }],
    });
  });

  it('returns 401 on all analytics metric routes when unauthenticated', async () => {
    mockedRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const founderScoresResponse = await getFounderScores(buildRequest('/api/admin/analytics/founder-scores'));
    const validationResponse = await getValidation(buildRequest('/api/admin/analytics/validation'));
    const mentoringResponse = await getMentoring(buildRequest('/api/admin/analytics/mentoring'));
    const revenueResponse = await getRevenue(buildRequest('/api/admin/analytics/revenue'));

    expect(founderScoresResponse.status).toBe(401);
    expect(validationResponse.status).toBe(401);
    expect(mentoringResponse.status).toBe(401);
    expect(revenueResponse.status).toBe(401);
  });

  it('returns 403 on all analytics metric routes when non-admin', async () => {
    mockedRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    );

    const founderScoresResponse = await getFounderScores(buildRequest('/api/admin/analytics/founder-scores'));
    const validationResponse = await getValidation(buildRequest('/api/admin/analytics/validation'));
    const mentoringResponse = await getMentoring(buildRequest('/api/admin/analytics/mentoring'));
    const revenueResponse = await getRevenue(buildRequest('/api/admin/analytics/revenue'));

    expect(founderScoresResponse.status).toBe(403);
    expect(validationResponse.status).toBe(403);
    expect(mentoringResponse.status).toBe(403);
    expect(revenueResponse.status).toBe(403);
  });

  it('returns founder score histogram bins and trend data for admins', async () => {
    const response = await getFounderScores(buildRequest('/api/admin/analytics/founder-scores'));
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        histogram: [
          { range: '0-20', count: 1 },
          { range: '20-40', count: 2 },
          { range: '40-60', count: 3 },
          { range: '60-80', count: 4 },
          { range: '80-100', count: 5 },
        ],
        trends: [
          {
            eventId: 'event-1',
            eventName: 'January Demo Day',
            date: '2026-01-10T00:00:00.000Z',
            averageScore: 73.5,
          },
        ],
      },
    });
  });

  it('returns validation metrics with participation, distribution, and average rating', async () => {
    const response = await getValidation(buildRequest('/api/admin/analytics/validation'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.participationPerEvent).toEqual([
      {
        eventId: 'event-1',
        eventName: 'January Demo Day',
        date: '2026-01-10T00:00:00.000Z',
        founderPitches: 6,
        averageScore: 73.5,
      },
    ]);
    expect(payload.data.ratingDistribution).toEqual([
      { range: '0-20', count: 1 },
      { range: '20-40', count: 2 },
      { range: '40-60', count: 3 },
      { range: '60-80', count: 4 },
      { range: '80-100', count: 5 },
    ]);
    expect(payload.data.averageRating).toBeCloseTo(63.3333333333, 6);
    expect(payload.data.totalValidationResponses).toBe(32);
  });

  it('returns mentoring acceptance-rate metric for admins', async () => {
    const response = await getMentoring(buildRequest('/api/admin/analytics/mentoring'));
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        matchAcceptanceRate: 0.625,
        matchAcceptanceRatePercent: 62.5,
      },
    });
  });

  it('returns revenue trend, churn-by-month, and subscription totals for admins', async () => {
    const response = await getRevenue(buildRequest('/api/admin/analytics/revenue'));
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        mrr: 120000,
        mrrTrend: [{ month: '2026-01', amountCents: 120000 }],
        churnRate: 0.3,
        churnRateByMonth: [{ month: '2026-01', amountCents: 2 }],
        subscriptionTotals: {
          active: 7,
          cancelled: 3,
          total: 10,
        },
      },
    });
  });
});
