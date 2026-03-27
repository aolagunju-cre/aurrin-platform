/**
 * Tests for the File Upload & Storage Pipeline (Issue #31)
 *
 * All Supabase client calls are mocked via setSupabaseClient() so no real
 * Supabase project is required to run these tests.
 */

import { uploadFile, UploadError, ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS, DEFAULT_SIGNED_URL_EXPIRY } from '../src/lib/storage/upload';
import { getSignedUrl, getSignedUrlForEntitlement, SignedUrlError } from '../src/lib/storage/signedUrl';
import { deleteFile, DeleteError } from '../src/lib/storage/delete';
import { runRetentionPolicy, scanFile } from '../src/lib/storage/retention';
import { setSupabaseClient, resetSupabaseClient, SupabaseClient, FileRecord } from '../src/lib/db/client';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const USER_ID = 'user-abc123';
const FILE_ID = 'file-uuid-001';
const STORAGE_PATH = `pitch-decks/${USER_ID}/1700000000000-uuid.pdf`;

function makeFileRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: FILE_ID,
    owner_id: USER_ID,
    file_name: 'pitch.pdf',
    file_type: 'application/pdf',
    file_size: 1024,
    storage_path: STORAGE_PATH,
    signed_url_expiry: DEFAULT_SIGNED_URL_EXPIRY['pitch-decks'],
    retention_days: 365,
    is_public: false,
    created_at: new Date().toISOString(),
    expires_at: null,
    ...overrides,
  };
}

function makeFile(name: string, type: string, sizeMB: number): File {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024);
  return new File([bytes], name, { type });
}

/** Buffer-based helper for Node/jsdom tests — bypasses File.arrayBuffer() compat issues. */
function makeBuffer(sizeMB: number): Buffer {
  return Buffer.alloc(sizeMB * 1024 * 1024);
}

function makeSupabaseClient(overrides: Partial<{
  uploadError: Error | null;
  removeError: Error | null;
  signedUrlResult: { signedUrl: string; error: Error | null };
  insertResult: { data: FileRecord | null; error: Error | null };
  getResult: { data: FileRecord | null; error: Error | null };
  deleteError: Error | null;
  expiredFiles: FileRecord[];
  auditError: Error | null;
}> = {}): SupabaseClient {
  const {
    uploadError = null,
    removeError = null,
    signedUrlResult = { signedUrl: 'https://signed.url/file', error: null },
    insertResult = { data: makeFileRecord(), error: null },
    getResult = { data: makeFileRecord(), error: null },
    deleteError = null,
    expiredFiles = [],
    auditError = null,
  } = overrides;

  return {
    storage: {
      upload: jest.fn().mockResolvedValue({ path: STORAGE_PATH, error: uploadError }),
      remove: jest.fn().mockResolvedValue({ error: removeError }),
      createSignedUrl: jest.fn().mockResolvedValue(signedUrlResult),
    },
    db: {
      insertFile: jest.fn().mockResolvedValue(insertResult),
      getFile: jest.fn().mockResolvedValue(getResult),
      deleteFile: jest.fn().mockResolvedValue({ error: deleteError }),
      getExpiredFiles: jest.fn().mockResolvedValue({ data: expiredFiles, error: null }),
      insertAuditLog: jest.fn().mockResolvedValue({ error: auditError }),
    },
  };
}

// ─── Upload Tests ────────────────────────────────────────────────────────────

describe('uploadFile()', () => {
  afterEach(() => resetSupabaseClient());

  it('uploads a valid PDF to pitch-decks and returns file_id and path', async () => {
    const client = makeSupabaseClient();
    setSupabaseClient(client);

    const buf = makeBuffer(1);
    const result = await uploadFile(buf, 'pitch-decks', USER_ID, {
      contentType: 'application/pdf',
      fileName: 'deck.pdf',
    });

    expect(result.file_id).toBe(FILE_ID);
    expect(result.path).toContain('pitch-decks');
    expect(client.storage.upload).toHaveBeenCalledTimes(1);
    expect(client.db.insertFile).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: USER_ID,
        file_type: 'application/pdf',
        expires_at: expect.any(String),
      })
    );
  });

  it('rejects a disallowed MIME type with INVALID_MIME_TYPE', async () => {
    setSupabaseClient(makeSupabaseClient());
    const buf = makeBuffer(1);

    await expect(
      uploadFile(buf, 'pitch-decks', USER_ID, { contentType: 'image/png', fileName: 'photo.png' })
    ).rejects.toThrow(expect.objectContaining({ code: 'INVALID_MIME_TYPE' }));
  });

  it('rejects a file that exceeds the bucket size limit (50MB for pitch-decks)', async () => {
    setSupabaseClient(makeSupabaseClient());
    const buf = makeBuffer(51);

    await expect(
      uploadFile(buf, 'pitch-decks', USER_ID, { contentType: 'application/pdf', fileName: 'big.pdf' })
    ).rejects.toThrow(expect.objectContaining({ code: 'FILE_TOO_LARGE' }));
  });

  it('uploads a JPEG to social-assets successfully', async () => {
    const client = makeSupabaseClient({
      insertResult: { data: makeFileRecord({ file_type: 'image/jpeg', storage_path: `social-assets/${USER_ID}/ts-uuid.jpg` }), error: null },
    });
    setSupabaseClient(client);

    const buf = makeBuffer(1);
    const result = await uploadFile(buf, 'social-assets', USER_ID, {
      contentType: 'image/jpeg',
      fileName: 'asset.jpg',
    });
    expect(result.file_id).toBeDefined();
  });

  it('rejects an image exceeding 5MB in social-assets', async () => {
    setSupabaseClient(makeSupabaseClient());
    const buf = makeBuffer(6);

    await expect(
      uploadFile(buf, 'social-assets', USER_ID, { contentType: 'image/jpeg', fileName: 'large.jpg' })
    ).rejects.toThrow(expect.objectContaining({ code: 'FILE_TOO_LARGE' }));
  });

  it('throws STORAGE_ERROR and cleans up if Supabase Storage fails', async () => {
    const client = makeSupabaseClient({ uploadError: new Error('S3 error') });
    setSupabaseClient(client);

    const buf = makeBuffer(1);
    await expect(
      uploadFile(buf, 'pitch-decks', USER_ID, { contentType: 'application/pdf', fileName: 'deck.pdf' })
    ).rejects.toThrow(expect.objectContaining({ code: 'STORAGE_ERROR' }));
  });

  it('throws DB_ERROR and cleans up storage if metadata insert fails', async () => {
    const client = makeSupabaseClient({
      insertResult: { data: null, error: new Error('DB constraint') },
    });
    setSupabaseClient(client);

    const buf = makeBuffer(1);
    await expect(
      uploadFile(buf, 'pitch-decks', USER_ID, { contentType: 'application/pdf', fileName: 'deck.pdf' })
    ).rejects.toThrow(expect.objectContaining({ code: 'DB_ERROR' }));
    // Should attempt storage cleanup
    expect(client.storage.remove).toHaveBeenCalledTimes(1);
  });

  it('generates a unique storage path per upload', async () => {
    const paths: string[] = [];
    const client: SupabaseClient = {
      storage: {
        upload: jest.fn().mockImplementation((_bucket, path) => {
          paths.push(path as string);
          return Promise.resolve({ path, error: null });
        }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ signedUrl: 'https://url', error: null }),
      },
      db: {
        insertFile: jest.fn().mockImplementation(() =>
          Promise.resolve({ data: makeFileRecord({ id: `id-${paths.length}` }), error: null })
        ),
        getFile: jest.fn(),
        deleteFile: jest.fn(),
        getExpiredFiles: jest.fn(),
        insertAuditLog: jest.fn(),
      },
    };
    setSupabaseClient(client);

    const buf = makeBuffer(1);
    await uploadFile(buf, 'pitch-decks', USER_ID, { contentType: 'application/pdf', fileName: 'deck.pdf' });
    await uploadFile(buf, 'pitch-decks', USER_ID, { contentType: 'application/pdf', fileName: 'deck.pdf' });

    expect(paths[0]).not.toEqual(paths[1]);
  });

  it('respects FILE_SIZE_LIMITS constants (100MB for generated-reports)', async () => {
    setSupabaseClient(makeSupabaseClient());
    const buf = makeBuffer(101);
    await expect(
      uploadFile(buf, 'generated-reports', USER_ID, { contentType: 'application/pdf', fileName: 'report.pdf' })
    ).rejects.toThrow(expect.objectContaining({ code: 'FILE_TOO_LARGE' }));
  });

  it('ALLOWED_MIME_TYPES includes application/pdf for pitch-decks', () => {
    expect(ALLOWED_MIME_TYPES['pitch-decks']).toContain('application/pdf');
  });

  it('FILE_SIZE_LIMITS enforces 50MB for pitch-decks', () => {
    expect(FILE_SIZE_LIMITS['pitch-decks']).toBe(50 * 1024 * 1024);
  });
});

// ─── Signed URL Tests ─────────────────────────────────────────────────────────

describe('getSignedUrl()', () => {
  afterEach(() => resetSupabaseClient());

  it('returns a signed URL for the file owner', async () => {
    setSupabaseClient(makeSupabaseClient());
    const url = await getSignedUrl(FILE_ID, USER_ID);
    expect(url).toContain('https://');
  });

  it('throws NOT_FOUND for a non-existent file', async () => {
    setSupabaseClient(makeSupabaseClient({ getResult: { data: null, error: null } }));
    await expect(getSignedUrl('missing-id', USER_ID)).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    );
  });

  it('throws UNAUTHORIZED when a different user requests the URL', async () => {
    setSupabaseClient(makeSupabaseClient());
    await expect(getSignedUrl(FILE_ID, 'other-user-id')).rejects.toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
  });

  it('allows admin to get URL for any file', async () => {
    setSupabaseClient(makeSupabaseClient());
    const url = await getSignedUrl(FILE_ID, 'admin-user-id', undefined, true);
    expect(url).toContain('https://');
  });

  it('throws STORAGE_ERROR if Supabase fails to generate the URL', async () => {
    setSupabaseClient(
      makeSupabaseClient({ signedUrlResult: { signedUrl: '', error: new Error('Storage error') } })
    );
    await expect(getSignedUrl(FILE_ID, USER_ID)).rejects.toThrow(
      expect.objectContaining({ code: 'STORAGE_ERROR' })
    );
  });

  it('uses default expiry of 7 days (604800s) for pitch-decks', async () => {
    const client = makeSupabaseClient();
    setSupabaseClient(client);

    await getSignedUrl(FILE_ID, USER_ID);

    expect(client.storage.createSignedUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      DEFAULT_SIGNED_URL_EXPIRY['pitch-decks'] // 604800
    );
  });

  it('accepts a custom expiry override', async () => {
    const client = makeSupabaseClient();
    setSupabaseClient(client);

    await getSignedUrl(FILE_ID, USER_ID, 600);

    expect(client.storage.createSignedUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      600
    );
  });
});

describe('getSignedUrlForEntitlement()', () => {
  afterEach(() => resetSupabaseClient());

  it('returns a signed URL without owner checks for entitlement downloads', async () => {
    setSupabaseClient(makeSupabaseClient({ getResult: { data: makeFileRecord({ owner_id: 'another-user' }), error: null } }));
    const url = await getSignedUrlForEntitlement(FILE_ID);
    expect(url).toContain('https://');
  });
});

// ─── Delete Tests ─────────────────────────────────────────────────────────────

describe('deleteFile()', () => {
  afterEach(() => resetSupabaseClient());

  it('deletes a file owned by the requesting user', async () => {
    const client = makeSupabaseClient();
    setSupabaseClient(client);

    await expect(deleteFile(FILE_ID, USER_ID)).resolves.toBeUndefined();
    expect(client.storage.remove).toHaveBeenCalledTimes(1);
    expect(client.db.deleteFile).toHaveBeenCalledWith(FILE_ID);
  });

  it('throws NOT_FOUND for a non-existent file', async () => {
    setSupabaseClient(makeSupabaseClient({ getResult: { data: null, error: null } }));
    await expect(deleteFile('missing-id', USER_ID)).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    );
  });

  it('throws UNAUTHORIZED when a non-owner attempts to delete', async () => {
    setSupabaseClient(makeSupabaseClient());
    await expect(deleteFile(FILE_ID, 'other-user')).rejects.toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
  });

  it('allows admin to delete any file', async () => {
    const client = makeSupabaseClient();
    setSupabaseClient(client);

    await expect(deleteFile(FILE_ID, 'admin-user', true)).resolves.toBeUndefined();
    expect(client.storage.remove).toHaveBeenCalledTimes(1);
  });

  it('throws STORAGE_ERROR when Supabase Storage removal fails', async () => {
    setSupabaseClient(makeSupabaseClient({ removeError: new Error('Remove failed') }));
    await expect(deleteFile(FILE_ID, USER_ID)).rejects.toThrow(
      expect.objectContaining({ code: 'STORAGE_ERROR' })
    );
  });

  it('throws DB_ERROR when Files table deletion fails', async () => {
    setSupabaseClient(makeSupabaseClient({ deleteError: new Error('FK violation') }));
    await expect(deleteFile(FILE_ID, USER_ID)).rejects.toThrow(
      expect.objectContaining({ code: 'DB_ERROR' })
    );
  });
});

// ─── Retention Policy Tests ───────────────────────────────────────────────────

describe('runRetentionPolicy()', () => {
  afterEach(() => resetSupabaseClient());

  it('returns zero deletions when no files are expired', async () => {
    setSupabaseClient(makeSupabaseClient({ expiredFiles: [] }));
    const result = await runRetentionPolicy('system');
    expect(result.deletedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('deletes expired files and writes audit log entries', async () => {
    const expired: FileRecord[] = [
      makeFileRecord({ id: 'expired-1' }),
      makeFileRecord({ id: 'expired-2', storage_path: `generated-reports/${USER_ID}/ts-uuid2.pdf` }),
    ];
    const client = makeSupabaseClient({ expiredFiles: expired });
    setSupabaseClient(client);

    const result = await runRetentionPolicy('system');

    expect(result.deletedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(client.storage.remove).toHaveBeenCalledTimes(2);
    expect(client.db.deleteFile).toHaveBeenCalledTimes(2);
    expect(client.db.insertAuditLog).toHaveBeenCalledTimes(2);
  });

  it('records errors for files that fail to delete without aborting the batch', async () => {
    const expired: FileRecord[] = [
      makeFileRecord({ id: 'will-fail' }),
      makeFileRecord({ id: 'will-succeed', storage_path: `exports/${USER_ID}/ts-uuid.json` }),
    ];
    let callCount = 0;
    const client: SupabaseClient = {
      ...makeSupabaseClient({ expiredFiles: expired }),
      storage: {
        upload: jest.fn(),
        remove: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve({ error: new Error('Storage fail') });
          return Promise.resolve({ error: null });
        }),
        createSignedUrl: jest.fn(),
      },
      db: {
        insertFile: jest.fn(),
        getFile: jest.fn(),
        deleteFile: jest.fn().mockResolvedValue({ error: null }),
        getExpiredFiles: jest.fn().mockResolvedValue({ data: expired, error: null }),
        insertAuditLog: jest.fn().mockResolvedValue({ error: null }),
      },
    };
    setSupabaseClient(client);

    const result = await runRetentionPolicy('system');

    expect(result.deletedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].fileId).toBe('will-fail');
  });

  it('writes audit log with retention_delete action', async () => {
    const expired = [makeFileRecord()];
    const client = makeSupabaseClient({ expiredFiles: expired });
    setSupabaseClient(client);

    await runRetentionPolicy('system-user');

    expect(client.db.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retention_delete',
        resource_type: 'file',
        resource_id: FILE_ID,
        changes: expect.objectContaining({
          before: expect.objectContaining({ file_id: FILE_ID }),
          after: null,
        }),
      })
    );
  });

  it('records an error when audit logging fails after deletion', async () => {
    const expired = [makeFileRecord()];
    const client = makeSupabaseClient({
      expiredFiles: expired,
      auditError: new Error('audit write failed'),
    });
    setSupabaseClient(client);

    const result = await runRetentionPolicy('system-user');

    expect(result.deletedCount).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({
        fileId: FILE_ID,
        error: expect.stringContaining('Audit log insert failed'),
      }),
    ]);
  });
});

// ─── Malware Scan Stub Tests ──────────────────────────────────────────────────

describe('scanFile()', () => {
  it('returns safe for any file path (Phase 2 stub)', async () => {
    const result = await scanFile('pitch-decks/user/file.pdf');
    expect(result).toBe('safe');
  });
});

// ─── ALLOWED_MIME_TYPES and size limit contract tests ─────────────────────────

describe('File type and size limit contracts', () => {
  it('pitch-decks allows only application/pdf', () => {
    expect(ALLOWED_MIME_TYPES['pitch-decks']).toEqual(['application/pdf']);
  });

  it('generated-reports allows application/pdf and zip formats', () => {
    expect(ALLOWED_MIME_TYPES['generated-reports']).toEqual([
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
    ]);
  });

  it('social-assets allows image/jpeg and image/png', () => {
    expect(ALLOWED_MIME_TYPES['social-assets']).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES['social-assets']).toContain('image/png');
  });

  it('exports allows application/json and text/csv', () => {
    expect(ALLOWED_MIME_TYPES['exports']).toContain('application/json');
    expect(ALLOWED_MIME_TYPES['exports']).toContain('text/csv');
  });

  it('pitch-decks size limit is 50MB', () => {
    expect(FILE_SIZE_LIMITS['pitch-decks']).toBe(50 * 1024 * 1024);
  });

  it('generated-reports size limit is 100MB', () => {
    expect(FILE_SIZE_LIMITS['generated-reports']).toBe(100 * 1024 * 1024);
  });

  it('social-assets size limit is 5MB', () => {
    expect(FILE_SIZE_LIMITS['social-assets']).toBe(5 * 1024 * 1024);
  });

  it('pitch-decks signed URL default expiry is 7 days (604800s)', () => {
    expect(DEFAULT_SIGNED_URL_EXPIRY['pitch-decks']).toBe(7 * 24 * 3600);
  });

  it('generated-reports signed URL default expiry is 1 hour (3600s)', () => {
    expect(DEFAULT_SIGNED_URL_EXPIRY['generated-reports']).toBe(3600);
  });
});
