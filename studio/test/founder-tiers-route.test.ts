/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/founder/tiers/route';
import { PATCH, DELETE } from '../src/app/api/founder/tiers/[tierId]/route';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { getSupabaseClient } from '../src/lib/db/client';
import type { SponsorshipTierRecord } from '../src/lib/db/client';

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

const SAMPLE_TIER: SponsorshipTierRecord = {
  id: 'tier-1',
  founder_id: 'user-founder-1',
  label: 'Bronze Supporter',
  amount_cents: 1000,
  perk_description: 'Name on website',
  sort_order: 0,
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function makeGetRequest(): NextRequest {
  return new NextRequest(new Request('http://localhost/api/founder/tiers', { method: 'GET' }));
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request('http://localhost/api/founder/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

function makePatchRequest(tierId: string, body: unknown): [NextRequest, { params: Promise<{ tierId: string }> }] {
  const req = new NextRequest(
    new Request(`http://localhost/api/founder/tiers/${tierId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return [req, { params: Promise.resolve({ tierId }) }];
}

function makeDeleteRequest(tierId: string): [NextRequest, { params: Promise<{ tierId: string }> }] {
  const req = new NextRequest(
    new Request(`http://localhost/api/founder/tiers/${tierId}`, { method: 'DELETE' })
  );
  return [req, { params: Promise.resolve({ tierId }) }];
}

// ─── GET /api/founder/tiers ────────────────────────────────────────────────

describe('GET /api/founder/tiers', () => {
  it('returns 401 when auth fails', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a founder', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(ADMIN_AUTH);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 with tiers ordered by sort_order', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      listSponsorshipTiersByFounderId: jest.fn().mockResolvedValue({ data: [SAMPLE_TIER], error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: SponsorshipTierRecord[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].label).toBe('Bronze Supporter');
    expect(mockDb.listSponsorshipTiersByFounderId).toHaveBeenCalledWith('user-founder-1');
  });

  it('returns 500 on db error', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      listSponsorshipTiersByFounderId: jest.fn().mockResolvedValue({ data: [], error: new Error('DB error') }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/founder/tiers ───────────────────────────────────────────────

describe('POST /api/founder/tiers', () => {
  it('returns 401 when auth fails', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );
    const res = await POST(makePostRequest({ label: 'Test', amount_dollars: 10, perk_description: 'Perk' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a founder', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(ADMIN_AUTH);
    const res = await POST(makePostRequest({ label: 'Test', amount_dollars: 10, perk_description: 'Perk' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when label is missing', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const res = await POST(makePostRequest({ amount_dollars: 10, perk_description: 'Perk' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is missing', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const res = await POST(makePostRequest({ label: 'Bronze', perk_description: 'Perk' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const res = await POST(makePostRequest({ label: 'Bronze', amount_dollars: 0, perk_description: 'Perk' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when perk_description is missing', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const res = await POST(makePostRequest({ label: 'Bronze', amount_dollars: 10 }));
    expect(res.status).toBe(400);
  });

  it('returns 201 with created tier and converts dollars to cents', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      insertSponsorshipTier: jest.fn().mockResolvedValue({ data: { ...SAMPLE_TIER, amount_cents: 1000 }, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await POST(makePostRequest({ label: 'Bronze Supporter', amount_dollars: 10, perk_description: 'Name on website' }));
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: SponsorshipTierRecord };
    expect(body.success).toBe(true);
    expect(mockDb.insertSponsorshipTier).toHaveBeenCalledWith(
      expect.objectContaining({
        founder_id: 'user-founder-1',
        label: 'Bronze Supporter',
        amount_cents: 1000,
        perk_description: 'Name on website',
      })
    );
  });

  it('accepts amount_cents directly', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      insertSponsorshipTier: jest.fn().mockResolvedValue({ data: SAMPLE_TIER, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await POST(makePostRequest({ label: 'Bronze', amount_cents: 2500, perk_description: 'Perk' }));
    expect(res.status).toBe(201);
    expect(mockDb.insertSponsorshipTier).toHaveBeenCalledWith(
      expect.objectContaining({ amount_cents: 2500 })
    );
  });
});

// ─── PATCH /api/founder/tiers/[tierId] ────────────────────────────────────

describe('PATCH /api/founder/tiers/[tierId]', () => {
  it('returns 401 when auth fails', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );
    const [req, ctx] = makePatchRequest('tier-1', { label: 'New Label' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a founder', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(ADMIN_AUTH);
    const [req, ctx] = makePatchRequest('tier-1', { label: 'New Label' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(403);
  });

  it('returns 403 when tier belongs to another founder (cross-founder mutation blocked)', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const otherFounderTier = { ...SAMPLE_TIER, founder_id: 'user-other-founder' };
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: otherFounderTier, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makePatchRequest('tier-1', { label: 'New Label' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(403);
  });

  it('returns 404 when tier does not exist', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makePatchRequest('nonexistent', { label: 'New' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 200 when tier is updated successfully', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const updatedTier = { ...SAMPLE_TIER, label: 'Updated Label' };
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: SAMPLE_TIER, error: null }),
      updateSponsorshipTier: jest.fn().mockResolvedValue({ data: updatedTier, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makePatchRequest('tier-1', { label: 'Updated Label' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: SponsorshipTierRecord };
    expect(body.success).toBe(true);
    expect(body.data.label).toBe('Updated Label');
  });

  it('converts amount_dollars to amount_cents on PATCH', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: SAMPLE_TIER, error: null }),
      updateSponsorshipTier: jest.fn().mockResolvedValue({ data: SAMPLE_TIER, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makePatchRequest('tier-1', { amount_dollars: 25 });
    await PATCH(req, ctx);
    expect(mockDb.updateSponsorshipTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({ amount_cents: 2500 })
    );
  });

  it('can toggle active status', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: SAMPLE_TIER, error: null }),
      updateSponsorshipTier: jest.fn().mockResolvedValue({ data: { ...SAMPLE_TIER, active: false }, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makePatchRequest('tier-1', { active: false });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    expect(mockDb.updateSponsorshipTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({ active: false })
    );
  });
});

// ─── DELETE /api/founder/tiers/[tierId] ───────────────────────────────────

describe('DELETE /api/founder/tiers/[tierId]', () => {
  it('returns 401 when auth fails', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );
    const [req, ctx] = makeDeleteRequest('tier-1');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a founder', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(ADMIN_AUTH);
    const [req, ctx] = makeDeleteRequest('tier-1');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
  });

  it('returns 403 when tier belongs to another founder (cross-founder delete blocked)', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const otherFounderTier = { ...SAMPLE_TIER, founder_id: 'user-other-founder' };
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: otherFounderTier, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makeDeleteRequest('tier-1');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
  });

  it('returns 404 when tier does not exist', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makeDeleteRequest('nonexistent');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 200 when tier is deleted successfully', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(FOUNDER_AUTH);
    const mockDb = {
      getSponsorshipTierById: jest.fn().mockResolvedValue({ data: SAMPLE_TIER, error: null }),
      deleteSponsorshipTier: jest.fn().mockResolvedValue({ error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const [req, ctx] = makeDeleteRequest('tier-1');
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    expect(mockDb.deleteSponsorshipTier).toHaveBeenCalledWith('tier-1');
  });
});
