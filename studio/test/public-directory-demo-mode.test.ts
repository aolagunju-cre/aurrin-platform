/** @jest-environment node */

import { NextRequest } from 'next/server';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}

describe('public directory demo mode routes', () => {
  const originalDemoMode = process.env.DEMO_MODE;

  beforeEach(() => {
    jest.resetModules();
    mockedGetSupabaseClient.mockReset();
    process.env.DEMO_MODE = 'true';
  });

  afterAll(() => {
    if (originalDemoMode === undefined) {
      delete process.env.DEMO_MODE;
      return;
    }

    process.env.DEMO_MODE = originalDemoMode;
  });

  it('lists filtered demo directory profiles without querying the database', async () => {
    const { GET } = await import('../src/app/api/public/directory/route');

    const response = await GET(
      buildRequest('http://localhost/api/public/directory?search=maya&industry=cleantech&stage=seed&event=evt-002')
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      expect.objectContaining({
        founder_slug: 'maya-chen-terravolt',
        founder_name: 'Maya Chen',
        company: 'TerraVolt Energy',
        industry: 'CleanTech',
        stage: 'Seed',
        score: 87,
      }),
    ]);
    expect(payload.pagination).toEqual({
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    });
    expect(payload.applied_filters).toEqual({
      search: 'maya',
      industry: 'cleantech',
      stage: 'seed',
      event: 'evt-002',
      minScore: 0,
      maxScore: 100,
    });
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns demo directory profile details with deterministic social links and event dates', async () => {
    const { GET } = await import('../src/app/api/public/directory/[founderSlug]/route');

    const response = await GET(new Request('http://localhost/api/public/directory/maya-chen-terravolt'), {
      params: Promise.resolve({ founderSlug: 'maya-chen-terravolt' }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({
      founder_slug: 'maya-chen-terravolt',
      name: 'Maya Chen',
      company: 'TerraVolt Energy',
      industry: 'CleanTech',
      stage: 'Seed',
      summary: expect.stringContaining('battery storage'),
      photo: null,
      score: 87,
      social_links: {
        website: 'https://terravoltenergy.ca',
        linkedin: 'https://linkedin.com/in/mayachen',
        twitter: null,
      },
      badges: ['Top Score', 'Audience Favorite'],
      deck_link: null,
      event: {
        id: 'evt-002',
        name: 'Aurrin Demo Day — February 2026',
        starts_at: '2026-02-21T18:00:00.000Z',
        ends_at: '2026-02-21T22:00:00.000Z',
      },
    });
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing demo directory profile slug', async () => {
    const { GET } = await import('../src/app/api/public/directory/[founderSlug]/route');

    const response = await GET(new Request('http://localhost/api/public/directory/missing-founder'), {
      params: Promise.resolve({ founderSlug: 'missing-founder' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Founder profile not found.',
    });
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });
});
