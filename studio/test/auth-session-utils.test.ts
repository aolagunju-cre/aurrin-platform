/** @jest-environment node */

import { getCurrentUser, resetSessionContext } from '../src/lib/auth/session';
import { headers } from 'next/headers';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

const mockedHeaders = headers as jest.MockedFunction<typeof headers>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;

describe('auth session utilities', () => {
  beforeEach(() => {
    resetSessionContext();
    jest.clearAllMocks();
  });

  it('returns current user payload when token is valid', async () => {
    mockedHeaders.mockResolvedValueOnce(
      new Headers({
        authorization: 'Bearer valid-token',
      }) as unknown as Awaited<ReturnType<typeof headers>>
    );
    mockedExtractTokenFromHeader.mockReturnValueOnce('valid-token');
    mockedVerifyJWT.mockResolvedValueOnce({
      sub: 'user-123',
      email: 'user@example.com',
      email_confirmed_at: '2026-03-27T00:00:00.000Z',
      iat: 1,
      exp: 2,
      aud: 'authenticated',
      iss: 'https://example.test/auth/v1',
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'user-123',
      email: 'user@example.com',
      emailConfirmed: true,
      roleAssignments: [],
    });
  });

  it('rejects invalid token payload and returns null', async () => {
    mockedHeaders.mockResolvedValueOnce(
      new Headers({
        authorization: 'Bearer invalid-token',
      }) as unknown as Awaited<ReturnType<typeof headers>>
    );
    mockedExtractTokenFromHeader.mockReturnValueOnce('invalid-token');
    mockedVerifyJWT.mockResolvedValueOnce(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
