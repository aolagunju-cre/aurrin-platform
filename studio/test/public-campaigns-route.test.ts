/** @jest-environment node */

import { GET } from '../src/app/api/public/campaigns/route';
import { listActiveCampaigns } from '../src/lib/campaigns/db';

jest.mock('../src/lib/campaigns/db', () => ({
  listActiveCampaigns: jest.fn(),
}));

const mockedListActiveCampaigns = listActiveCampaigns as jest.MockedFunction<typeof listActiveCampaigns>;

describe('GET /api/public/campaigns', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns only sanitized public campaign summary fields', async () => {
    mockedListActiveCampaigns.mockResolvedValueOnce({
      data: [
        {
          id: 'campaign-1',
          founder_id: 'founder-1',
          title: 'Orbit Labs Raise',
          description: 'Helping founders ship climate software.',
          story: 'Long internal story',
          funding_goal_cents: 100000,
          amount_raised_cents: 25000,
          donor_count: 4,
          e_transfer_email: 'private@example.com',
          status: 'active',
          pledge_tiers: [],
          created_at: '2026-03-20T00:00:00.000Z',
          updated_at: '2026-03-21T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const response = await GET();
    const payload = await response.json() as { success: boolean; data: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      {
        id: 'campaign-1',
        title: 'Orbit Labs Raise',
        description: 'Helping founders ship climate software.',
        funding_goal_cents: 100000,
        amount_raised_cents: 25000,
        donor_count: 4,
        status: 'active',
      },
    ]);
    expect(payload.data[0].founder_id).toBeUndefined();
    expect(payload.data[0].e_transfer_email).toBeUndefined();
    expect(payload.data[0].story).toBeUndefined();
  });
});
