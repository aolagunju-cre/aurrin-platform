/** @jest-environment node */

import { GET as getShareCard } from '../src/app/api/public/founders/[founderId]/share-card/route';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('public founder share-card route', () => {
  let mockDb: Record<string, jest.Mock>;
  let mockStorage: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedGetSupabaseClient.mockReset();

    mockDb = {
      queryTable: jest.fn(),
    };
    mockStorage = {
      createSignedUrl: jest.fn(),
      upload: jest.fn(),
      remove: jest.fn(),
    };

    mockedGetSupabaseClient.mockReturnValue({
      db: mockDb as never,
      storage: mockStorage as never,
    });
  });

  it('returns signed social asset metadata for downstream share-card/OG consumers', async () => {
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'founder-1',
            company_name: 'Orbit Labs',
            tagline: 'Funding climate tools',
            bio: 'We build carbon measurement software.',
            website: 'https://orbit.example',
            user: { name: 'Sam Founder' },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-1',
            score_aggregate: 89.5,
            score_breakdown: { Market: 90, Team: 89 },
            is_published: true,
            published_at: '2026-03-01T00:00:00.000Z',
            event: { id: 'event-1', name: 'Spring Demo Day', publishing_start: '2026-03-01T00:00:00.000Z' },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            storage_path: 'social-assets/profile/founder-1/event-1/og.png',
            signed_url_expiry: 3600,
          },
        ],
        error: null,
      });
    mockStorage.createSignedUrl.mockResolvedValueOnce({
      signedUrl: 'https://example.test/signed/founder-1-og.png',
      error: null,
    });

    const response = await getShareCard(new Request('http://localhost/api/public/founders/founder-1/share-card'), {
      params: Promise.resolve({ founderId: 'founder-1' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.assets).toEqual([
      expect.objectContaining({
        asset_type: 'profile',
        founder_id: 'founder-1',
        event_id: 'event-1',
        format: 'og',
        open_graph_image_url: 'https://example.test/signed/founder-1-og.png',
        signed_download: {
          url: 'https://example.test/signed/founder-1-og.png',
          expires_in: 3600,
        },
        download_action_label: 'Download Share Card',
      }),
    ]);
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockStorage.remove).not.toHaveBeenCalled();
  });

  it('returns 404 when founder does not exist', async () => {
    mockDb.queryTable.mockResolvedValueOnce({ data: [], error: null });

    const response = await getShareCard(new Request('http://localhost/api/public/founders/missing/share-card'), {
      params: Promise.resolve({ founderId: 'missing' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.message).toBe('Founder not found.');
  });

  it('filters highlights to pitches published for public view and normalizes breakdown values', async () => {
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'founder-1',
            company_name: 'Orbit Labs',
            tagline: 'Funding climate tools',
            bio: 'We build carbon measurement software.',
            website: 'https://orbit.example',
            user: { name: 'Sam Founder' },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-published',
            score_aggregate: 91,
            score_breakdown: { Market: 95, Team: 'ignore-me' },
            is_published: false,
            published_at: '2026-03-01T00:00:00.000Z',
            event: { id: 'event-1', name: 'Spring Demo Day', publishing_start: '2000-03-01T00:00:00.000Z' },
          },
          {
            id: 'pitch-hidden',
            score_aggregate: 88,
            score_breakdown: { Market: 88 },
            is_published: false,
            published_at: null,
            event: { id: 'event-2', name: 'Future Demo Day', publishing_start: '3026-03-01T00:00:00.000Z' },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const response = await getShareCard(new Request('http://localhost/api/public/founders/founder-1/share-card'), {
      params: Promise.resolve({ founderId: 'founder-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.highlights).toEqual([
      expect.objectContaining({
        pitch_id: 'pitch-published',
        event_id: 'event-1',
        score_breakdown: { Market: 95 },
      }),
    ]);
  });
});
