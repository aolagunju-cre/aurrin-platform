/** @jest-environment node */

import { getPublicDirectoryProfile } from '../src/lib/directory/profile';
import { getSupabaseClient } from '../src/lib/db/client';
import { PUBLIC_DIRECTORY_PITCH_SELECT } from '../src/lib/directory/query';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('public directory profile loader', () => {
  let mockDb: {
    queryTable: jest.Mock;
  };

  beforeEach(() => {
    mockedGetSupabaseClient.mockReset();

    mockDb = {
      queryTable: jest.fn(),
    };

    mockedGetSupabaseClient.mockReturnValue({
      db: mockDb as never,
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      } as never,
    });
  });

  it('builds a single encoded select query for the profile detail lookup', async () => {
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-1',
            public_profile_slug: 'orbit-labs',
            score_aggregate: 89.5,
            pitch_deck_url: 'https://decks.example/orbit.pdf',
            validation_summary: { badges: ['Top Score'] },
            founder: {
              id: 'founder-1',
              company_name: 'Orbit Labs',
              bio: 'AI for climate accounting',
              website: 'https://orbit.example',
              social_proof: { linkedin: 'https://linkedin.com/company/orbit' },
              user: {
                name: 'Sam Founder',
                email: 'sam@example.com',
                avatar_url: 'https://img.example/sam.png',
              },
            },
            event: {
              id: 'event-1',
              name: 'Spring Demo Day',
              status: 'archived',
              starts_at: '2026-03-01T00:00:00.000Z',
              ends_at: '2026-03-02T00:00:00.000Z',
            },
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            email: 'sam@example.com',
            industry: 'Climate',
            stage: 'Seed',
            pitch_summary: 'AI for climate accounting',
            website: 'https://orbit.example',
            twitter: null,
            linkedin: 'https://linkedin.com/company/orbit',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'campaign-1', status: 'active', updated_at: '2026-03-10T00:00:00.000Z' }],
        error: null,
      });

    const result = await getPublicDirectoryProfile('orbit-labs');

    expect(result.error).toBeNull();
    expect(result.data).toEqual(
      expect.objectContaining({
        founder_slug: 'orbit-labs',
        founder_id: 'founder-1',
        campaign_id: 'campaign-1',
        name: 'Sam Founder',
      })
    );
    expect(mockDb.queryTable).toHaveBeenNthCalledWith(
      1,
      'founder_pitches',
      [
        'public_profile_slug=eq.orbit-labs',
        'visible_in_directory=eq.true',
        'is_published=eq.true',
        `select=${encodeURIComponent(PUBLIC_DIRECTORY_PITCH_SELECT)}`,
        'limit=1',
      ].join('&')
    );
  });
});
