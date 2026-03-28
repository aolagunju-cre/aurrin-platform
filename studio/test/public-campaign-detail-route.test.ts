/** @jest-environment node */

import { GET } from '../src/app/api/public/campaigns/[id]/route';
import { getCampaignById, listDonationsByCampaignId } from '../src/lib/campaigns/db';

jest.mock('../src/lib/campaigns/db', () => ({
  getCampaignById: jest.fn(),
  listDonationsByCampaignId: jest.fn(),
}));

const mockedGetCampaignById = getCampaignById as jest.MockedFunction<typeof getCampaignById>;
const mockedListDonationsByCampaignId = listDonationsByCampaignId as jest.MockedFunction<typeof listDonationsByCampaignId>;

describe('GET /api/public/campaigns/[id]', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 for draft campaigns', async () => {
    mockedGetCampaignById.mockResolvedValueOnce({
      data: {
        id: 'campaign-1',
        founder_id: 'founder-1',
        title: 'Orbit Labs Raise',
        description: 'Helping founders ship climate software.',
        story: 'Long internal story',
        funding_goal_cents: 100000,
        amount_raised_cents: 25000,
        donor_count: 4,
        e_transfer_email: 'private@example.com',
        status: 'draft',
        pledge_tiers: [],
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
      error: null,
    });

    const response = await GET(new Request('http://localhost/api/public/campaigns/campaign-1'), {
      params: Promise.resolve({ id: 'campaign-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(mockedListDonationsByCampaignId).not.toHaveBeenCalled();
  });

  it('returns a sanitized public campaign detail payload', async () => {
    mockedGetCampaignById.mockResolvedValueOnce({
      data: {
        id: 'campaign-1',
        founder_id: 'founder-1',
        title: 'Orbit Labs Raise',
        description: 'Helping founders ship climate software.',
        story: 'Public campaign story',
        funding_goal_cents: 100000,
        amount_raised_cents: 25000,
        donor_count: 4,
        e_transfer_email: 'private@example.com',
        status: 'active',
        pledge_tiers: [{ name: 'Supporter', amount_cents: 5000, description: 'Thank-you note' }],
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-21T00:00:00.000Z',
      },
      error: null,
    });
    mockedListDonationsByCampaignId.mockResolvedValueOnce({
      data: [
        {
          id: 'donation-1',
          campaign_id: 'campaign-1',
          donor_name: 'Private Donor',
          donor_email: 'private@example.com',
          amount_cents: 5000,
          is_anonymous: false,
          stripe_session_id: 'sess_1',
          created_at: '2026-03-21T00:00:00.000Z',
        },
        {
          id: 'donation-2',
          campaign_id: 'campaign-1',
          donor_name: 'Should not show',
          donor_email: 'anonymous@example.com',
          amount_cents: 2500,
          is_anonymous: true,
          stripe_session_id: 'sess_2',
          created_at: '2026-03-22T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const response = await GET(new Request('http://localhost/api/public/campaigns/campaign-1'), {
      params: Promise.resolve({ id: 'campaign-1' }),
    });
    const payload = await response.json() as { success: boolean; data: Record<string, unknown> & { donations: Array<Record<string, unknown>> } };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({
      id: 'campaign-1',
      title: 'Orbit Labs Raise',
      description: 'Helping founders ship climate software.',
      funding_goal_cents: 100000,
      amount_raised_cents: 25000,
      donor_count: 4,
      status: 'active',
      story: 'Public campaign story',
      pledge_tiers: [{ name: 'Supporter', amount_cents: 5000, description: 'Thank-you note' }],
      donations: [
        {
          id: 'donation-1',
          donor_name: 'Private Donor',
          amount_cents: 5000,
          created_at: '2026-03-21T00:00:00.000Z',
        },
        {
          id: 'donation-2',
          donor_name: 'Anonymous',
          amount_cents: 2500,
          created_at: '2026-03-22T00:00:00.000Z',
        },
      ],
    });
    expect(payload.data.founder_id).toBeUndefined();
    expect(payload.data.e_transfer_email).toBeUndefined();
    expect(payload.data.donations[0].donor_email).toBeUndefined();
  });
});
