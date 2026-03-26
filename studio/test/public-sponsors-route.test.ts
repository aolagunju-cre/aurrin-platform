/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/public/sponsors/route';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}

describe('GET /api/public/sponsors', () => {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const futureIso = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const pastIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    const listSponsors = jest.fn().mockResolvedValue({
      error: null,
      data: [
        {
          id: 's1',
          name: 'Gold Site',
          logo_url: 'https://img/gold.png',
          website_url: 'https://gold.example',
          tier: 'gold',
          placement_scope: 'site-wide',
          event_id: null,
          end_date: futureIso,
          pricing_cents: 250000,
          status: 'active',
          display_priority: 0,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: 's2',
          name: 'Silver Event',
          logo_url: null,
          website_url: null,
          tier: 'silver',
          placement_scope: 'event',
          event_id: 'event-1',
          end_date: futureIso,
          pricing_cents: 100000,
          status: 'active',
          display_priority: 0,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: 's3',
          name: 'Expired Site',
          logo_url: null,
          website_url: null,
          tier: 'bronze',
          placement_scope: 'site-wide',
          event_id: null,
          end_date: pastIso,
          pricing_cents: 50000,
          status: 'active',
          display_priority: 0,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: 's4',
          name: 'Inactive Site',
          logo_url: null,
          website_url: null,
          tier: 'gold',
          placement_scope: 'site-wide',
          event_id: null,
          end_date: futureIso,
          pricing_cents: 250000,
          status: 'inactive',
          display_priority: 0,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ],
    });

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        listSponsors,
      },
    } as unknown as ReturnType<typeof getSupabaseClient>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns only display-safe site-wide sponsors when no event filter is provided', async () => {
    const response = await GET(buildRequest('http://localhost/api/public/sponsors'));
    const payload = await response.json() as { success: boolean; data: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toEqual({
      id: 's1',
      name: 'Gold Site',
      logo: 'https://img/gold.png',
      link: 'https://gold.example',
      tier: 'gold',
      scope: 'site-wide',
      event_id: null,
    });
    expect(payload.data[0].pricing_cents).toBeUndefined();
    expect(payload.data[0].status).toBeUndefined();
  });

  it('includes event-scoped sponsors when event_id is provided and keeps tier-first ordering', async () => {
    const response = await GET(buildRequest('http://localhost/api/public/sponsors?event_id=event-1'));
    const payload = await response.json() as { success: boolean; data: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.map((row) => row.id)).toEqual(['s1', 's2']);
  });
});
