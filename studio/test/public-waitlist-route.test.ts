/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/public/waitlist/route';
import { upsertPlatformWaitlistSignup } from '../src/lib/waitlist/db';

jest.mock('../src/lib/waitlist/db', () => ({
  upsertPlatformWaitlistSignup: jest.fn(),
}));

const mockedUpsertPlatformWaitlistSignup =
  upsertPlatformWaitlistSignup as jest.MockedFunction<
    typeof upsertPlatformWaitlistSignup
  >;

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new Request('http://localhost/api/public/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

describe('POST /api/public/waitlist', () => {
  beforeEach(() => {
    mockedUpsertPlatformWaitlistSignup.mockReset();
  });

  it('returns validation errors for incomplete payloads', async () => {
    const response = await POST(buildRequest({
      firstName: '',
      lastName: '',
      email: 'bad-email',
      phone: '123',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errors.first_name).toBe('First name is required');
    expect(body.errors.last_name).toBe('Last name is required');
    expect(body.errors.email).toBe('Email format is invalid');
    expect(body.errors.phone).toBe('Phone number format is invalid');
    expect(mockedUpsertPlatformWaitlistSignup).not.toHaveBeenCalled();
  });

  it('persists a normalized waitlist signup', async () => {
    mockedUpsertPlatformWaitlistSignup.mockResolvedValueOnce({
      data: {
        id: 'signup-1',
        first_name: 'Jordan',
        last_name: 'Lee',
        email: 'jordan@example.com',
        phone: '(403) 555-0123',
        source: 'public-waitlist',
        metadata: {},
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      },
      error: null,
    });

    const response = await POST(buildRequest({
      firstName: '  Jordan ',
      lastName: 'Lee  ',
      email: 'Jordan@Example.com',
      phone: '(403) 555-0123',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Waitlist submitted',
      data: { id: 'signup-1' },
    });
    expect(mockedUpsertPlatformWaitlistSignup).toHaveBeenCalledWith({
      first_name: 'Jordan',
      last_name: 'Lee',
      email: 'jordan@example.com',
      phone: '(403) 555-0123',
      source: 'public-waitlist',
      metadata: {},
    });
  });

  it('accepts snake_case payloads and custom source metadata', async () => {
    mockedUpsertPlatformWaitlistSignup.mockResolvedValueOnce({
      data: {
        id: 'signup-2',
        first_name: 'Avery',
        last_name: 'Stone',
        email: 'avery@example.com',
        phone: '4035550199',
        source: 'aurrin-app-v2',
        metadata: { campaign: 'crowdfunding-launch' },
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      },
      error: null,
    });

    const response = await POST(buildRequest({
      first_name: 'Avery',
      last_name: 'Stone',
      email: 'avery@example.com',
      phone: '4035550199',
      source: 'aurrin-app-v2',
      metadata: { campaign: 'crowdfunding-launch' },
    }));

    expect(response.status).toBe(200);
    expect(mockedUpsertPlatformWaitlistSignup).toHaveBeenCalledWith({
      first_name: 'Avery',
      last_name: 'Stone',
      email: 'avery@example.com',
      phone: '4035550199',
      source: 'aurrin-app-v2',
      metadata: { campaign: 'crowdfunding-launch' },
    });
  });

  it('returns a server error when persistence fails', async () => {
    mockedUpsertPlatformWaitlistSignup.mockResolvedValueOnce({
      data: null,
      error: new Error('insert failed'),
    });

    const response = await POST(buildRequest({
      firstName: 'Jordan',
      lastName: 'Lee',
      email: 'jordan@example.com',
      phone: '(403) 555-0123',
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      message: 'Could not save waitlist signup',
    });
  });
});
