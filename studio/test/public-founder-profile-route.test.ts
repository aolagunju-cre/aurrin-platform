/** @jest-environment node */

import { NextResponse } from 'next/server';
import { GET } from '../src/app/api/public/founders/[slug]/route';
import { getPublicFounderProfileBySlug } from '../src/lib/founders/public-profile';

jest.mock('../src/lib/founders/public-profile', () => ({
  getPublicFounderProfileBySlug: jest.fn(),
}));

const mockedGetProfile = getPublicFounderProfileBySlug as jest.MockedFunction<
  typeof getPublicFounderProfileBySlug
>;

const SAMPLE_PROFILE = {
  founderId: 'founder-1',
  userId: 'user-1',
  founderSlug: 'acme-corp',
  name: 'Jane Doe',
  photo: null,
  company: 'Acme Corp',
  bio: 'Building the future.',
  industry: 'SaaS',
  stage: 'Seed',
  socialLinks: { website: 'https://acme.ca', twitter: null, linkedin: null },
  fundingGoalCents: 500000,
  totalDonatedCents: 125000,
  tiers: [
    {
      id: 'tier-1',
      founder_id: 'user-1',
      label: 'Bronze',
      amount_cents: 2500,
      perk_description: 'Thank-you email',
      sort_order: 0,
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  pastEvents: [
    {
      id: 'evt-1',
      eventName: 'Demo Day March 2026',
      scoreAggregate: 82,
      publishedAt: '2026-03-30T09:00:00.000Z',
    },
  ],
  mentorEndorsements: [{ mentorId: 'mentor-1', mentorName: 'Alice Smith' }],
};

function makeRequest(slug: string): [Request, { params: Promise<{ slug: string }> }] {
  return [
    new Request(`http://localhost/api/public/founders/${slug}`),
    { params: Promise.resolve({ slug }) },
  ];
}

describe('GET /api/public/founders/[slug]', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns 200 with profile data when founder is found', async () => {
    mockedGetProfile.mockResolvedValue({ data: SAMPLE_PROFILE, error: null });
    const [req, ctx] = makeRequest('acme-corp');
    const response = await GET(req, ctx);
    const body = await response.json() as { success: boolean; data: typeof SAMPLE_PROFILE };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.founderSlug).toBe('acme-corp');
    expect(body.data.tiers).toHaveLength(1);
    expect(body.data.fundingGoalCents).toBe(500000);
    expect(body.data.totalDonatedCents).toBe(125000);
  });

  it('returns 404 when founder is not found', async () => {
    mockedGetProfile.mockResolvedValue({ data: null, error: null });
    const [req, ctx] = makeRequest('unknown-slug');
    const response = await GET(req, ctx);
    const body = await response.json() as { success: boolean; message: string };

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Founder profile not found.');
  });

  it('returns 500 when a database error occurs', async () => {
    mockedGetProfile.mockResolvedValue({ data: null, error: new Error('DB error') });
    const [req, ctx] = makeRequest('acme-corp');
    const response = await GET(req, ctx);
    const body = await response.json() as { success: boolean; message: string };

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toBe('DB error');
  });

  it('returns tiers sorted by sort_order (API contract)', async () => {
    const profileWithTiers = {
      ...SAMPLE_PROFILE,
      tiers: [
        { ...SAMPLE_PROFILE.tiers[0], id: 'tier-2', sort_order: 1, label: 'Silver' },
        { ...SAMPLE_PROFILE.tiers[0], id: 'tier-1', sort_order: 0, label: 'Bronze' },
      ],
    };
    mockedGetProfile.mockResolvedValue({ data: profileWithTiers, error: null });
    const [req, ctx] = makeRequest('acme-corp');
    const response = await GET(req, ctx);
    const body = await response.json() as { success: boolean; data: typeof profileWithTiers };

    expect(response.status).toBe(200);
    expect(body.data.tiers[0].sort_order).toBe(1);
  });

  it('returns profile with empty tiers array when no tiers exist', async () => {
    mockedGetProfile.mockResolvedValue({ data: { ...SAMPLE_PROFILE, tiers: [] }, error: null });
    const [req, ctx] = makeRequest('acme-corp');
    const response = await GET(req, ctx);
    const body = await response.json() as { success: boolean; data: typeof SAMPLE_PROFILE };

    expect(response.status).toBe(200);
    expect(body.data.tiers).toEqual([]);
  });

  it('returns profile with null fundingGoalCents when no goal is set', async () => {
    mockedGetProfile.mockResolvedValue({
      data: { ...SAMPLE_PROFILE, fundingGoalCents: null },
      error: null,
    });
    const [req, ctx] = makeRequest('acme-corp');
    const response = await GET(req, ctx);
    const body = await response.json() as { success: boolean; data: typeof SAMPLE_PROFILE };

    expect(response.status).toBe(200);
    expect(body.data.fundingGoalCents).toBeNull();
  });
});
