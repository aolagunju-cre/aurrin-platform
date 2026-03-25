/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/upload/route';
import { uploadFile } from '../src/lib/storage/upload';
import { getSignedUrl } from '../src/lib/storage/signedUrl';
import { verifyJWT } from '../src/lib/auth/jwt';

jest.mock('../src/lib/storage/upload', () => {
  class UploadError extends Error {
    code: string;

    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    uploadFile: jest.fn(),
    UploadError,
  };
});

jest.mock('../src/lib/storage/signedUrl', () => {
  class SignedUrlError extends Error {
    code: string;

    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    getSignedUrl: jest.fn(),
    SignedUrlError,
  };
});

jest.mock('../src/lib/auth/jwt', () => {
  const actual = jest.requireActual('../src/lib/auth/jwt');
  return {
    ...actual,
    verifyJWT: jest.fn(),
  };
});

const mockedUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;
const mockedVerifyJwt = verifyJWT as jest.MockedFunction<typeof verifyJWT>;

function buildRequest(authHeader?: string): NextRequest {
  const formData = new FormData();
  formData.append('file', new File(['pdf'], 'deck.pdf', { type: 'application/pdf' }));
  formData.append('bucket', 'pitch-decks');

  return new NextRequest(
    new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: authHeader ? { authorization: authHeader } : undefined,
      body: formData,
    })
  );
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    mockedUploadFile.mockReset();
    mockedGetSignedUrl.mockReset();
    mockedVerifyJwt.mockReset();
  });

  it('returns 401 when the authorization header is missing', async () => {
    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
    expect(mockedUploadFile).not.toHaveBeenCalled();
  });

  it('uploads the file for the verified JWT subject', async () => {
    mockedVerifyJwt.mockResolvedValue({
      sub: 'user-123',
      email: 'user@example.com',
      iat: 1,
      exp: 9999999999,
      aud: 'authenticated',
      iss: 'test',
    });
    mockedUploadFile.mockResolvedValue({
      file_id: 'file-123',
      path: 'pitch-decks/user-123/deck.pdf',
    });
    mockedGetSignedUrl.mockResolvedValue('https://signed.example/file-123');

    const response = await POST(buildRequest('Bearer jwt-token'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedUploadFile).toHaveBeenCalledWith(
      expect.any(File),
      'pitch-decks',
      'user-123'
    );
    expect(mockedGetSignedUrl).toHaveBeenCalledWith('file-123', 'user-123');
    expect(payload).toEqual({
      file_id: 'file-123',
      path: 'pitch-decks/user-123/deck.pdf',
      signed_url: 'https://signed.example/file-123',
    });
  });
});
