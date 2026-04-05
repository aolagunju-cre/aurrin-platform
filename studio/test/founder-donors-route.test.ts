/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/founder/donors/route';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { getSupabaseClient } from '../src/lib/db/client';
import type { DonationWithTierRecord } from '../src/lib/db/client';

jest.mock('../src/lib/auth/founder', () => ({
  requireFounderOrAdmin: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/demo/data', () => ({
  DEMO_MODE: false,
}));

const mockedRequireFounderOrAdmin = requireFounderOrAdmin as jest.MockedFunction<typeof requireFounderOrAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

const FOUNDER_AUTH = {
  userId: 'user-founder-1',
  auth: {} as never,
  founder: { id: 'founder-1' } as never,
  roleAssignments: [],
  isAdmin: false,
  isFounder: true,
};

const ADMIN_AUTH = {
  userId: 'user-admin-1',
  auth: {} as never,
  founder: null,
  roleAssignments: [],
  isAdmin: true,
  isFounder: false,
};

const SAMPLE_DONATION: DonationWithTierRecord = {
  id: 'donation-1',
  founder_id: 'user-founder-1',
  donor_email: 'alice@example.com',
  donor_user_id: null,
  tier_id: 'tier-1',
  tier_label: 'Bronze Supporter',
  amount_cents: 1000,
  stripe_payment_intent_id: 'pi_test_1',
  status: 'completed',
  created_at: '2026-01-15T10:00:00.000Z',
};

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/founder/donors');
}

// ─── GET /api/founder/donors ─────────────────────────────────────────────

describe('GET /api/founder/donors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when auth fails', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a founder (admin-only user)', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(ADMIN_AUTH);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 with donation list for authenticated founder', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      listDonationsByFounderId: jest.fn().mockResolvedValue({ data: [SAMPLE_DONATION], error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: DonationWithTierRecord[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('donation-1');
    expect(body.data[0].tier_label).toBe('Bronze Supporter');
    expect(mockDb.listDonationsByFounderId).toHaveBeenCalledWith('user-founder-1');
  });

  it('returns 200 with empty array when founder has no donations', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      listDonationsByFounderId: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: DonationWithTierRecord[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it('returns 500 on DB error', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      listDonationsByFounderId: jest.fn().mockResolvedValue({ data: [], error: new Error('DB failure') }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });

  it('returns donations with null tier_label when tier is not matched', async () => {
    const noTierDonation: DonationWithTierRecord = { ...SAMPLE_DONATION, tier_id: null, tier_label: null };
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      listDonationsByFounderId: jest.fn().mockResolvedValue({ data: [noTierDonation], error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: DonationWithTierRecord[] };
    expect(body.data[0].tier_label).toBeNull();
  });

  it('scopes donations to the authenticated founder (does not expose other founders\' data)', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      listDonationsByFounderId: jest.fn().mockResolvedValue({ data: [SAMPLE_DONATION], error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    await GET(makeGetRequest());
    expect(mockDb.listDonationsByFounderId).toHaveBeenCalledWith('user-founder-1');
    expect(mockDb.listDonationsByFounderId).not.toHaveBeenCalledWith('user-other-founder');
  });
});
