/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as listDirectory } from '../src/app/api/public/directory/route';
import { GET as getDirectoryProfile } from '../src/app/api/public/directory/[founderSlug]/route';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}

describe('public directory API routes', () => {
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

  it('lists only directory-visible archived profiles and applies AND-combined search/filter constraints', async () => {
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-1',
            public_profile_slug: 'orbit-labs',
            score_aggregate: 92,
            pitch_deck_url: 'https://decks.example/orbit.pdf',
            validation_summary: { badges: ['Top Score'] },
            founder: {
              id: 'founder-1',
              company_name: 'Orbit Labs',
              bio: 'AI for climate accounting',
              website: 'https://orbit.example',
              social_proof: null,
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
          {
            id: 'pitch-2',
            public_profile_slug: 'hidden-company',
            score_aggregate: 95,
            pitch_deck_url: null,
            validation_summary: null,
            founder: {
              id: 'founder-2',
              company_name: 'Hidden Co',
              bio: 'Should not be listed',
              website: null,
              social_proof: null,
              user: {
                name: 'Hidden Founder',
                email: 'hidden@example.com',
                avatar_url: null,
              },
            },
            event: {
              id: 'event-1',
              name: 'Spring Demo Day',
              status: 'live',
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
            industry: 'Tech',
            stage: 'Seed',
            pitch_summary: 'AI for climate accounting',
            website: 'https://orbit.example',
            twitter: '@orbit',
            linkedin: 'https://linkedin.com/company/orbit',
            updated_at: '2026-03-10T00:00:00.000Z',
          },
          {
            email: 'hidden@example.com',
            industry: 'Fintech',
            stage: 'Series A',
            pitch_summary: 'Should not be listed',
            website: null,
            twitter: null,
            linkedin: null,
            updated_at: '2026-03-10T00:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    const response = await listDirectory(
      buildRequest(
        'http://localhost/api/public/directory?search=climate&industry=tech&stage=seed&event=event-1&minScore=90&maxScore=95'
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      {
        founder_slug: 'orbit-labs',
        founder_name: 'Sam Founder',
        company: 'Orbit Labs',
        industry: 'Tech',
        stage: 'Seed',
        summary: 'AI for climate accounting',
        photo: 'https://img.example/sam.png',
        score: 92,
        event: {
          id: 'event-1',
          name: 'Spring Demo Day',
        },
      },
    ]);
    expect(payload.pagination.total).toBe(1);
  });

  it('constrains score query bounds to 0-100 and keeps non-sensitive listing payload shape', async () => {
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-1',
            public_profile_slug: 'orbit-labs',
            score_aggregate: 100,
            pitch_deck_url: null,
            validation_summary: { judge_scores: [{ total: 100 }] },
            founder: {
              id: 'founder-1',
              company_name: 'Orbit Labs',
              bio: 'AI for climate accounting',
              website: 'https://orbit.example',
              social_proof: null,
              user: {
                name: 'Sam Founder',
                email: 'sam@example.com',
                avatar_url: null,
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
            industry: 'Tech',
            stage: 'Seed',
            pitch_summary: 'AI for climate accounting',
            website: null,
            twitter: null,
            linkedin: null,
            updated_at: '2026-03-10T00:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    const response = await listDirectory(
      buildRequest('http://localhost/api/public/directory?minScore=-55&maxScore=500')
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.applied_filters.minScore).toBe(0);
    expect(payload.applied_filters.maxScore).toBe(100);
    expect(payload.data[0].validation_summary).toBeUndefined();
  });

  it('returns profile detail contract fields without judge score or validation internals', async () => {
    mockDb.queryTable
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pitch-1',
            public_profile_slug: 'orbit-labs',
            score_aggregate: 89.5,
            pitch_deck_url: 'https://decks.example/orbit.pdf',
            validation_summary: {
              badges: ['Top Score', 'Audience Favorite'],
              judge_scores: [{ category: 'market', score: 90 }],
              validation_data: { responses: 200 },
            },
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
            industry: 'Tech',
            stage: 'Seed',
            pitch_summary: 'AI for climate accounting',
            website: 'https://orbit.example',
            twitter: '@orbit',
            linkedin: null,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    const response = await getDirectoryProfile(new Request('http://localhost/api/public/directory/orbit-labs'), {
      params: Promise.resolve({ founderSlug: 'orbit-labs' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.data).toEqual(
      expect.objectContaining({
        founder_slug: 'orbit-labs',
        campaign_id: null,
        name: 'Sam Founder',
        company: 'Orbit Labs',
        industry: 'Tech',
        stage: 'Seed',
        summary: 'AI for climate accounting',
        photo: 'https://img.example/sam.png',
        score: 89.5,
        social_links: {
          website: 'https://orbit.example',
          linkedin: 'https://linkedin.com/company/orbit',
          twitter: '@orbit',
        },
        badges: ['Top Score', 'Audience Favorite'],
        deck_link: 'https://decks.example/orbit.pdf',
      })
    );

    expect(payload.data.judge_scores).toBeUndefined();
    expect(payload.data.validation_data).toBeUndefined();
  });

  it('returns non-success response for hidden or non-published profile slug', async () => {
    mockDb.queryTable.mockResolvedValueOnce({ data: [], error: null });

    const response = await getDirectoryProfile(new Request('http://localhost/api/public/directory/hidden-co'), {
      params: Promise.resolve({ founderSlug: 'hidden-co' }),
    });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.success).toBe(false);
  });
});
