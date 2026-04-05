/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/admin/donations/route';
import { requireAdmin } from '../src/lib/auth/admin';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/demo/data', () => ({
  DEMO_MODE: false,
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(): NextRequest {
  return new NextRequest(
    new Request('http://localhost/api/admin/donations', {
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    })
  );
}

const ADMIN_CONTEXT = {
  userId: 'admin-1',
  auth: {
    sub: 'admin-1',
    email: 'admin@example.com',
    iat: 0,
    exp: 9999999999,
    aud: 'authenticated',
    iss: 'https://example.supabase.co/auth/v1',
  },
  email: 'admin@example.com',
  isDemo: false,
  roleAssignments: [],
};

const SAMPLE_DONATIONS = [
  {
    id: 'donation-1',
    founder_id: 'founder-user-1',
    donor_email: 'alice@example.com',
    donor_user_id: null,
    tier_id: 'tier-1',
    amount_cents: 10000,
    stripe_payment_intent_id: 'pi_1',
    status: 'completed',
    created_at: '2026-03-20T10:00:00.000Z',
    tier_label: 'Gold Sponsor',
    founder_company_name: 'Acme Corp',
  },
  {
    id: 'donation-2',
    founder_id: 'founder-user-2',
    donor_email: null,
    donor_user_id: null,
    tier_id: null,
    amount_cents: 2500,
    stripe_payment_intent_id: 'pi_2',
    status: 'completed',
    created_at: '2026-03-15T08:30:00.000Z',
    tier_label: null,
    founder_company_name: null,
  },
];

describe('GET /api/admin/donations', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedRequireAdmin.mockReset();
    mockedGetSupabaseClient.mockReset();

    mockedRequireAdmin.mockResolvedValue(ADMIN_CONTEXT);

    mockDb = {
      listAllDonations: jest.fn().mockResolvedValue({
        data: SAMPLE_DONATIONS,
        error: null,
      }),
    };

    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as ReturnType<typeof getSupabaseClient>);
  });

  it('returns 200 with all donations for admin user', async () => {
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data: typeof SAMPLE_DONATIONS };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('donation-1');
    expect(body.data[0].founder_company_name).toBe('Acme Corp');
    expect(body.data[0].tier_label).toBe('Gold Sponsor');
    expect(body.data[1].tier_label).toBeNull();
    expect(body.data[1].founder_company_name).toBeNull();
  });

  it('returns 403 when non-admin tries to access', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    );
    const response = await GET(buildRequest());
    expect(response.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
  });

  it('returns 500 when database fails', async () => {
    mockDb.listAllDonations.mockResolvedValue({ data: [], error: new Error('DB error') });
    const response = await GET(buildRequest());
    expect(response.status).toBe(500);
    const body = await response.json() as { success: boolean; message: string };
    expect(body.success).toBe(false);
  });

  it('returns donations ordered with correct shape', async () => {
    const response = await GET(buildRequest());
    const body = await response.json() as { success: boolean; data: typeof SAMPLE_DONATIONS };
    expect(body.data[0].amount_cents).toBe(10000);
    expect(body.data[0].stripe_payment_intent_id).toBe('pi_1');
    expect(body.data[1].amount_cents).toBe(2500);
  });

  it('returns empty array when there are no donations', async () => {
    mockDb.listAllDonations.mockResolvedValue({ data: [], error: null });
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });
});
