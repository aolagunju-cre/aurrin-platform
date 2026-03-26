/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/admin/ping/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;

function buildRequest(headers: Record<string, string> = { authorization: 'Bearer valid-token' }): NextRequest {
  return new NextRequest(new Request('http://localhost/api/admin/ping', { method: 'GET', headers }));
}

describe('admin API guard', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedExtractTokenFromHeader.mockReset();
    mockedVerifyJWT.mockReset();

    mockedExtractTokenFromHeader.mockImplementation((authHeader) => (authHeader ? 'valid-token' : null));
    mockedVerifyJWT.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });

    mockDb = {
      insertFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      getExpiredFiles: jest.fn(),
      insertAuditLog: jest.fn(),
      insertOutboxJob: jest.fn(),
      fetchPendingJobs: jest.fn(),
      updateJobState: jest.fn(),
      getFounderApplicationById: jest.fn(),
      getFounderApplicationByEmail: jest.fn(),
      insertFounderApplication: jest.fn(),
      updateFounderApplication: jest.fn(),
      getUserByEmail: jest.fn(),
      insertUser: jest.fn(),
      getFounderByUserId: jest.fn(),
      insertFounder: jest.fn(),
      getRoleAssignmentsByUserId: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'ra-1',
            user_id: 'user-1',
            role: 'admin',
            scope: 'global',
            scoped_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          },
        ],
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

  it('returns 401 for unauthenticated requests', async () => {
    mockedExtractTokenFromHeader.mockReturnValueOnce(null);

    const response = await GET(buildRequest({ authorization: '' }));
    expect(response.status).toBe(401);

    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'Unauthorized' });
  });

  it('returns 403 for authenticated non-admin requests', async () => {
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({ data: [], error: null });

    const response = await GET(buildRequest());
    expect(response.status).toBe(403);

    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'Forbidden' });
  });

  it('ignores untrusted app_metadata admin claims when role_assignments lacks global admin', async () => {
    mockedVerifyJWT.mockResolvedValueOnce({
      sub: 'user-1',
      email: 'user@example.com',
      app_metadata: { role: 'admin', roles: ['admin'] },
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });
    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({ data: [], error: null });

    const response = await GET(buildRequest());
    expect(response.status).toBe(403);
  });

  it('returns 200 for global admin users', async () => {
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      data: {
        user_id: 'user-1',
      },
    });
  });
});
