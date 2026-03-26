/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../src/app/api/admin/analytics/export/route';
import {
  getCohortAggregates,
  getEventTimeSeries,
  getKpiBaseAggregates,
  getRevenueChurnAggregates,
  getScoreDistribution,
} from '../src/lib/analytics/queries';
import { requireAdmin } from '../src/lib/auth/admin';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/analytics/queries', () => ({
  getKpiBaseAggregates: jest.fn(),
  getScoreDistribution: jest.fn(),
  getEventTimeSeries: jest.fn(),
  getCohortAggregates: jest.fn(),
  getRevenueChurnAggregates: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetKpiBaseAggregates = getKpiBaseAggregates as jest.MockedFunction<typeof getKpiBaseAggregates>;
const mockedGetScoreDistribution = getScoreDistribution as jest.MockedFunction<typeof getScoreDistribution>;
const mockedGetEventTimeSeries = getEventTimeSeries as jest.MockedFunction<typeof getEventTimeSeries>;
const mockedGetCohortAggregates = getCohortAggregates as jest.MockedFunction<typeof getCohortAggregates>;
const mockedGetRevenueChurnAggregates = getRevenueChurnAggregates as jest.MockedFunction<typeof getRevenueChurnAggregates>;

function buildRequest(type: string): NextRequest {
  return new NextRequest(new Request(`http://localhost/api/admin/analytics/export?type=${type}&startDate=2026-01-01&endDate=2026-01-31`, { method: 'GET' }));
}

describe('admin analytics export route', () => {
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

    mockedGetCohortAggregates.mockResolvedValue({
      byFounderStage: [{ value: 'seed', count: 7 }],
      byIndustry: [{ value: 'fintech', count: 5 }],
      byEventCohort: [{ eventId: 'event-1', count: 6, averageScore: 73.5 }],
    });

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

  it('returns 401 when request is unauthenticated', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await GET(buildRequest('json'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Unauthorized' });
  });

  it('rejects unsupported export type values with 400', async () => {
    const response = await GET(buildRequest('pdf'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Invalid export type. Supported values: csv, json.',
    });
  });

  it('returns JSON export with required sections and timestamped filename', async () => {
    const response = await GET(buildRequest('json'));
    expect(response.status).toBe(200);

    const contentDisposition = response.headers.get('Content-Disposition');
    expect(contentDisposition).toMatch(/^attachment; filename="analytics-export-.+\.json"$/);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(Object.keys(payload.data)).toEqual([
      'events',
      'founders',
      'scores',
      'validation',
      'subscriptions',
      'revenue',
    ]);

    expect(payload.data.events.totalEvents).toBe(2);
    expect(payload.data.founders.totalFounders).toBe(10);
    expect(payload.data.scores.totalScoresSubmitted).toBe(12);
    expect(payload.data.validation.totalResponses).toBe(32);
    expect(payload.data.subscriptions.total).toBe(10);
    expect(payload.data.revenue.totalRevenueCents).toBe(330000);
  });

  it('returns CSV export with deterministic header/sections and timestamped filename', async () => {
    const response = await GET(buildRequest('csv'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');

    const contentDisposition = response.headers.get('Content-Disposition');
    expect(contentDisposition).toMatch(/^attachment; filename="analytics-export-.+\.csv"$/);

    const csv = await response.text();
    const lines = csv.split('\n');

    expect(lines[0]).toBe('section,metric,date,eventId,eventName,range,cohort,month,value,count,amountCents,averageScore');
    expect(lines.some((line) => line.startsWith('events,totalEvents'))).toBe(true);
    expect(lines.some((line) => line.startsWith('founders,totalFounders'))).toBe(true);
    expect(lines.some((line) => line.startsWith('scores,totalScoresSubmitted'))).toBe(true);
    expect(lines.some((line) => line.startsWith('validation,totalResponses'))).toBe(true);
    expect(lines.some((line) => line.startsWith('subscriptions,active'))).toBe(true);
    expect(lines.some((line) => line.startsWith('revenue,totalRevenueCents'))).toBe(true);
  });
});
