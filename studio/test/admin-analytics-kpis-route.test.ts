/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../src/app/api/admin/analytics/kpis/route';
import { getKpiBaseAggregates } from '../src/lib/analytics/queries';
import { requireAdmin } from '../src/lib/auth/admin';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/analytics/queries', () => ({
  getKpiBaseAggregates: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetKpiBaseAggregates = getKpiBaseAggregates as jest.MockedFunction<typeof getKpiBaseAggregates>;

function buildRequest(url = 'http://localhost/api/admin/analytics/kpis?startDate=2026-01-01&endDate=2026-01-31'): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}

describe('admin analytics KPI route', () => {
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
      eventCount: 4,
      founderCount: 22,
      judgeCount: 6,
      totalScores: 44,
      validationResponses: 88,
      matchSuccessRate: 0.5,
      revenueCents: 123400,
      activeSubscriptions: 17,
      subscriptionChurnRate: 0.1,
    });
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Unauthorized' });
  });

  it('returns 403 for authenticated non-admin requests', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    );

    const response = await GET(buildRequest());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Forbidden' });
  });

  it('returns KPI payload with exact required fields for admin requests', async () => {
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        totalEvents: 4,
        totalFounders: 22,
        totalJudges: 6,
        totalScoresSubmitted: 44,
        totalValidationResponses: 88,
        activeSubscriptions: 17,
        mrr: 123400,
      },
    });

    expect(mockedGetKpiBaseAggregates).toHaveBeenCalledWith({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });
});
