/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { GET as listSponsors, POST as createSponsor } from '../src/app/api/admin/sponsors/route';
import { DELETE as deleteSponsor, PATCH as updateSponsor } from '../src/app/api/admin/sponsors/[id]/route';
import { auditLog } from '../src/lib/audit/log';
import { requireAdmin } from '../src/lib/auth/admin';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedAuditLog = auditLog as jest.MockedFunction<typeof auditLog>;

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('admin sponsors routes', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedRequireAdmin.mockResolvedValue({
      userId: 'admin-1',
      auth: {} as never,
    });
    mockedAuditLog.mockReset();

    const sponsor = {
      id: 'sponsor-1',
      name: 'Acme Ventures',
      logo_url: 'https://example.com/logo.png',
      website_url: 'https://example.com',
      tier: 'silver',
      placement_scope: 'site-wide',
      event_id: null,
      end_date: '2026-12-31T00:00:00.000Z',
      pricing_cents: 100000,
      status: 'active',
      display_priority: 0,
      created_at: '2026-03-26T00:00:00.000Z',
      updated_at: '2026-03-26T00:00:00.000Z',
    };

    mockDb = {
      listSponsors: jest.fn().mockResolvedValue({ data: [sponsor], error: null }),
      getSponsorById: jest.fn().mockResolvedValue({ data: sponsor, error: null }),
      insertSponsor: jest.fn().mockResolvedValue({ data: sponsor, error: null }),
      updateSponsor: jest.fn().mockResolvedValue({ data: { ...sponsor, name: 'Updated Sponsor' }, error: null }),
      deleteSponsor: jest.fn().mockResolvedValue({ error: null }),
      getEventById: jest.fn().mockResolvedValue({
        data: {
          id: 'event-1',
          name: 'Demo Day',
        },
        error: null,
      }),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });
  });

  it('GET /api/admin/sponsors returns sponsors and tier config', async () => {
    const response = await listSponsors(buildRequest('http://localhost/api/admin/sponsors', 'GET'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toEqual(expect.objectContaining({
      name: 'Acme Ventures',
      tier: 'silver',
      scope: 'site-wide',
      end_date: '2026-12-31T00:00:00.000Z',
      pricing: 100000,
    }));
    expect(payload.tier_config).toEqual(expect.arrayContaining([
      { tier: 'bronze', pricing_cents: 50000 },
      { tier: 'silver', pricing_cents: 100000 },
      { tier: 'gold', pricing_cents: 250000 },
    ]));
  });

  it('POST /api/admin/sponsors creates sponsor with validated payload and event scope', async () => {
    const response = await createSponsor(
      buildRequest('http://localhost/api/admin/sponsors', 'POST', {
        name: 'Acme Ventures',
        logo: 'https://example.com/logo.png',
        website: 'https://example.com',
        tier: 'gold',
        scope: 'event',
        event: 'event-1',
        end_date: '2026-12-31T00:00:00.000Z',
        pricing: 250000,
      })
    );

    expect(response.status).toBe(201);
    expect(mockDb.getEventById).toHaveBeenCalledWith('event-1');
    expect(mockDb.insertSponsor).toHaveBeenCalledWith(expect.objectContaining({
      tier: 'gold',
      placement_scope: 'event',
      event_id: 'event-1',
      pricing_cents: 250000,
    }));
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'sponsor_created',
      'admin-1',
      expect.objectContaining({ resource_type: 'sponsor' }),
      expect.any(Object)
    );
  });

  it('POST /api/admin/sponsors rejects invalid tier/scope payload with 400', async () => {
    const invalidTier = await createSponsor(
      buildRequest('http://localhost/api/admin/sponsors', 'POST', {
        name: 'Bad Sponsor',
        tier: 'platinum',
        scope: 'site-wide',
        end_date: '2026-12-31T00:00:00.000Z',
      })
    );
    expect(invalidTier.status).toBe(400);

    const missingEvent = await createSponsor(
      buildRequest('http://localhost/api/admin/sponsors', 'POST', {
        name: 'Event Sponsor',
        tier: 'bronze',
        scope: 'event',
        end_date: '2026-12-31T00:00:00.000Z',
      })
    );
    expect(missingEvent.status).toBe(400);
  });

  it('PATCH /api/admin/sponsors/[id] updates sponsor and writes audit log', async () => {
    const response = await updateSponsor(
      buildRequest('http://localhost/api/admin/sponsors/sponsor-1', 'PATCH', {
        name: 'Updated Sponsor',
        tier: 'bronze',
        scope: 'site-wide',
        end_date: '2027-01-01T00:00:00.000Z',
        pricing: 50000,
        status: 'inactive',
      }),
      { params: Promise.resolve({ id: 'sponsor-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.updateSponsor).toHaveBeenCalledWith('sponsor-1', expect.objectContaining({
      name: 'Updated Sponsor',
      tier: 'bronze',
      placement_scope: 'site-wide',
      status: 'inactive',
    }));
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'sponsor_updated',
      'admin-1',
      expect.objectContaining({ resource_type: 'sponsor' }),
      expect.any(Object)
    );
  });

  it('DELETE /api/admin/sponsors/[id] deletes sponsor and writes audit log', async () => {
    const response = await deleteSponsor(
      buildRequest('http://localhost/api/admin/sponsors/sponsor-1', 'DELETE'),
      { params: Promise.resolve({ id: 'sponsor-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.deleteSponsor).toHaveBeenCalledWith('sponsor-1');
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'sponsor_deleted',
      'admin-1',
      expect.objectContaining({ resource_type: 'sponsor' }),
      expect.any(Object)
    );
  });

  it('enforces admin guard', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await listSponsors(buildRequest('http://localhost/api/admin/sponsors', 'GET'));
    expect(response.status).toBe(401);
  });
});

describe('sponsor RLS contract migration', () => {
  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/db/migrations/011_sponsors_admin_contract.sql'),
    'utf8'
  );

  it('defines public read-only and admin manage policies', () => {
    expect(migrationSql).toContain('CREATE POLICY sponsors_admin_manage ON sponsors');
    expect(migrationSql).toContain('FOR ALL');
    expect(migrationSql).toContain("has_role(auth.current_user_id(), 'admin'::user_role)");
    expect(migrationSql).toContain('CREATE POLICY sponsors_public_read ON sponsors');
    expect(migrationSql).toContain('FOR SELECT');
    expect(migrationSql).toContain('USING (TRUE)');
  });
});
