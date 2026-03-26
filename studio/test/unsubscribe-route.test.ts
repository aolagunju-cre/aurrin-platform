/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/unsubscribe/route';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function buildRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request('http://localhost/api/unsubscribe', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}

describe('POST /api/unsubscribe', () => {
  const mockDb = {
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
  };

  beforeEach(() => {
    mockDb.getUserByEmail.mockReset();
    mockDb.updateUser.mockReset();
    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        getUserByEmail: mockDb.getUserByEmail,
        updateUser: mockDb.updateUser,
      },
    } as never);
  });

  it('unsubscribes when token and email match', async () => {
    mockDb.getUserByEmail.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        avatar_url: null,
        unsubscribed: false,
        unsubscribe_token: '11111111-1111-4111-8111-111111111111',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    mockDb.updateUser.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        avatar_url: null,
        unsubscribed: true,
        unsubscribe_token: '11111111-1111-4111-8111-111111111111',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const response = await POST(
      buildRequest({
        email: 'jane@example.com',
        token: '11111111-1111-4111-8111-111111111111',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDb.updateUser).toHaveBeenCalledWith('user-1', { unsubscribed: true });
  });

  it('rejects invalid token format', async () => {
    const response = await POST(
      buildRequest({
        email: 'jane@example.com',
        token: 'not-a-uuid',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockDb.getUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects mismatched token for email', async () => {
    mockDb.getUserByEmail.mockResolvedValueOnce({
      data: {
        id: 'user-2',
        email: 'jane@example.com',
        name: 'Jane',
        avatar_url: null,
        unsubscribed: false,
        unsubscribe_token: '11111111-1111-4111-8111-111111111111',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const response = await POST(
      buildRequest({
        email: 'jane@example.com',
        token: '22222222-2222-4222-8222-222222222222',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockDb.updateUser).not.toHaveBeenCalled();
  });
});
