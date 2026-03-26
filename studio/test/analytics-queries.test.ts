/** @jest-environment node */

import {
  __analyticsCacheTtlMs,
  __resetAnalyticsCache,
  getKpiBaseAggregates,
  getScoreDistribution,
} from '../src/lib/analytics/queries';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('analytics query helpers', () => {
  const queryTable = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    __resetAnalyticsCache();

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        queryTable,
      } as never,
    });
  });

  it('uses a strict 5-minute TTL cache for aggregate queries', async () => {
    queryTable.mockResolvedValue({
      data: [
        { id: 'p1', score_aggregate: 10, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'p2', score_aggregate: 85, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });

    await getScoreDistribution({ now: 0 });
    await getScoreDistribution({ now: 299_999 });
    expect(queryTable).toHaveBeenCalledTimes(1);

    await getScoreDistribution({ now: __analyticsCacheTtlMs + 1 });
    expect(queryTable).toHaveBeenCalledTimes(2);
  });

  it('can bypass cache for tests', async () => {
    queryTable.mockResolvedValue({
      data: [{ id: 'p1', score_aggregate: 50, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });

    await getScoreDistribution({ now: 0, bypassCache: true });
    await getScoreDistribution({ now: 1, bypassCache: true });

    expect(queryTable).toHaveBeenCalledTimes(2);
  });

  it('bins score edges exactly at 0, 20, 40, 60, 80, 100', async () => {
    queryTable.mockResolvedValue({
      data: [
        { id: 's0', score_aggregate: 0, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 's20', score_aggregate: 20, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 's40', score_aggregate: 40, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 's60', score_aggregate: 60, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 's80', score_aggregate: 80, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 's100', score_aggregate: 100, event_id: 'e1', created_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });

    const bins = await getScoreDistribution({ bypassCache: true });
    const counts = Object.fromEntries(bins.map((bin) => [bin.label, bin.count]));

    expect(counts).toEqual({
      '0-20': 2,
      '20-40': 1,
      '40-60': 1,
      '60-80': 1,
      '80-100': 1,
    });
  });

  it('propagates startDate/endDate filters into transactional table queries', async () => {
    queryTable.mockImplementation(async (table: string) => {
      if (table === 'events') return { data: [], error: null };
      if (table === 'founders') return { data: [], error: null };
      if (table === 'role_assignments') return { data: [], error: null };
      if (table === 'judge_scores') return { data: [], error: null };
      if (table === 'audience_responses') return { data: [], error: null };
      if (table === 'mentor_matches') return { data: [], error: null };
      if (table === 'subscriptions') return { data: [], error: null };
      if (table === 'transactions') return { data: [], error: null };
      return { data: [], error: null };
    });

    await getKpiBaseAggregates({
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.000Z',
      bypassCache: true,
    });

    const eventQuery = queryTable.mock.calls.find((call) => call[0] === 'events')?.[1] as string;
    const transactionQuery = queryTable.mock.calls.find((call) => call[0] === 'transactions')?.[1] as string;

    expect(eventQuery).toContain('starts_at=gte.2026-01-01T00%3A00%3A00.000Z');
    expect(eventQuery).toContain('starts_at=lte.2026-01-31T23%3A59%3A59.000Z');
    expect(transactionQuery).toContain('created_at=gte.2026-01-01T00%3A00%3A00.000Z');
    expect(transactionQuery).toContain('created_at=lte.2026-01-31T23%3A59%3A59.000Z');
  });
});
