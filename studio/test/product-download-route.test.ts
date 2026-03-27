/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getProductDownload } from '../src/app/api/products/[productId]/download/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { extractTokenFromHeader, verifyJWT } from '../src/lib/auth/jwt';
import { hasEntitlement } from '../src/lib/payments/entitlements';
import { getSignedUrlForEntitlement } from '../src/lib/storage/signedUrl';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn(),
  verifyJWT: jest.fn(),
}));

jest.mock('../src/lib/payments/entitlements', () => ({
  hasEntitlement: jest.fn(),
}));

jest.mock('../src/lib/storage/signedUrl', () => ({
  SignedUrlError: class SignedUrlError extends Error {
    code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'STORAGE_ERROR';

    constructor(message: string, code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'STORAGE_ERROR') {
      super(message);
      this.code = code;
    }
  },
  getSignedUrlForEntitlement: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockedVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
const mockedHasEntitlement = hasEntitlement as jest.MockedFunction<typeof hasEntitlement>;
const mockedGetSignedUrlForEntitlement = getSignedUrlForEntitlement as jest.MockedFunction<typeof getSignedUrlForEntitlement>;

describe('GET /api/products/[productId]/download', () => {
  const db = {
    getProductById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: db as never,
    });

    mockedExtractTokenFromHeader.mockImplementation((header) => (header ? 'token' : null));
    mockedVerifyJWT.mockResolvedValue({
      sub: '11111111-1111-4111-8111-111111111111',
      email: 'buyer@example.com',
      iat: 0,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    });
    mockedHasEntitlement.mockResolvedValue(true);
    mockedGetSignedUrlForEntitlement.mockResolvedValue('https://signed.example/download');

    db.getProductById.mockResolvedValue({
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        product_type: 'digital',
        file_id: '33333333-3333-4333-8333-333333333333',
      },
      error: null,
    });
  });

  it('returns signed URL for authorized entitlements', async () => {
    const response = await getProductDownload(
      new NextRequest('http://localhost/api/products/22222222-2222-4222-8222-222222222222/download', {
        headers: { authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ productId: '22222222-2222-4222-8222-222222222222' }) }
    );

    expect(response.status).toBe(200);
    expect(mockedHasEntitlement).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    );
    expect(mockedGetSignedUrlForEntitlement).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        product_id: '22222222-2222-4222-8222-222222222222',
        signed_url: 'https://signed.example/download',
      },
    });
  });

  it('returns 403 when entitlement is missing', async () => {
    mockedHasEntitlement.mockResolvedValueOnce(false);

    const response = await getProductDownload(
      new NextRequest('http://localhost/api/products/22222222-2222-4222-8222-222222222222/download', {
        headers: { authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ productId: '22222222-2222-4222-8222-222222222222' }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Entitlement required.' });
  });
});
