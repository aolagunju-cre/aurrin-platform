/**
 * File upload utility for Supabase Storage.
 * Validates file type and size, generates a unique storage path,
 * uploads to the specified bucket, and records metadata in the Files table.
 */

import { randomUUID } from 'crypto';
import { getSupabaseClient } from '../db/client';

export type SupportedBucket = 'pitch-decks' | 'generated-reports' | 'social-assets' | 'exports';

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'pitch-decks': ['application/pdf'],
  'generated-reports': ['application/pdf'],
  'social-assets': ['image/jpeg', 'image/png'],
  'exports': ['application/json', 'text/csv'],
};

export const FILE_SIZE_LIMITS: Record<string, number> = {
  'pitch-decks': 50 * 1024 * 1024,    // 50 MB
  'generated-reports': 100 * 1024 * 1024, // 100 MB
  'social-assets': 5 * 1024 * 1024,   // 5 MB
  'exports': 100 * 1024 * 1024,       // 100 MB (same as PDF)
};

export const DEFAULT_RETENTION_DAYS: Record<string, number> = {
  'pitch-decks': 365,
  'generated-reports': 90,
  'social-assets': 90,
  'exports': 30,
};

export const DEFAULT_SIGNED_URL_EXPIRY: Record<string, number> = {
  'pitch-decks': 7 * 24 * 3600,  // 7 days
  'generated-reports': 3600,      // 1 hour
  'social-assets': 3600,          // 1 hour
  'exports': 3600,                // 1 hour
};

export interface UploadOptions {
  retentionDays?: number;
  signedUrlExpiry?: number;
  isPublic?: boolean;
  contentType?: string;
  fileName?: string;
}

export interface UploadResult {
  file_id: string;
  path: string;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_MIME_TYPE' | 'FILE_TOO_LARGE' | 'STORAGE_ERROR' | 'DB_ERROR'
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Upload a file to Supabase Storage and record its metadata in the Files table.
 *
 * @param file - The file to upload (File in browser, Buffer in Node)
 * @param bucket - Target storage bucket
 * @param userId - ID of the uploading user (used in path + ownership)
 * @param options - Optional overrides for retention, expiry, visibility
 * @returns file_id and storage path on success
 */
export async function uploadFile(
  file: File | Buffer,
  bucket: SupportedBucket,
  userId: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const mimeType = file instanceof Buffer
    ? options.contentType ?? 'application/octet-stream'
    : (file as File).type;

  const fileSize = file instanceof Buffer
    ? file.length
    : (file as File).size;

  const fileName = file instanceof Buffer
    ? options.fileName ?? `file-${Date.now()}`
    : (file as File).name;

  // Validate MIME type
  const allowedMimes = ALLOWED_MIME_TYPES[bucket] ?? [];
  if (!allowedMimes.includes(mimeType)) {
    throw new UploadError(
      `File type '${mimeType}' is not allowed in bucket '${bucket}'. Allowed: ${allowedMimes.join(', ')}`,
      'INVALID_MIME_TYPE'
    );
  }

  // Enforce size limit
  const sizeLimit = FILE_SIZE_LIMITS[bucket];
  if (fileSize > sizeLimit) {
    const limitMB = Math.round(sizeLimit / (1024 * 1024));
    throw new UploadError(
      `File size ${fileSize} bytes exceeds the ${limitMB}MB limit for bucket '${bucket}'`,
      'FILE_TOO_LARGE'
    );
  }

  const ext = getExtension(mimeType, fileName);
  const timestamp = Date.now();
  const uuid = randomUUID();
  const relativeStoragePath = `${userId}/${timestamp}-${uuid}.${ext}`;
  const storagePath = `${bucket}/${relativeStoragePath}`;

  const client = getSupabaseClient();

  // Upload to Supabase Storage
  const { error: uploadError } = await client.storage.upload(
    bucket,
    relativeStoragePath,
    file instanceof Buffer ? file : file,
    { contentType: mimeType }
  );

  if (uploadError) {
    throw new UploadError(`Storage upload failed: ${uploadError.message}`, 'STORAGE_ERROR');
  }

  // Record metadata in Files table
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS[bucket];
  const signedUrlExpiry = options.signedUrlExpiry ?? DEFAULT_SIGNED_URL_EXPIRY[bucket];
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error: dbError } = await client.db.insertFile({
    owner_id: userId,
    file_name: fileName,
    file_type: mimeType,
    file_size: fileSize,
    storage_path: storagePath,
    signed_url_expiry: signedUrlExpiry,
    retention_days: retentionDays,
    is_public: options.isPublic ?? false,
    expires_at: expiresAt,
  });

  if (dbError || !data) {
    // Best-effort cleanup of uploaded file
    await client.storage.remove(bucket, [relativeStoragePath]);
    throw new UploadError(`Failed to record file metadata: ${dbError?.message}`, 'DB_ERROR');
  }

  return { file_id: data.id, path: storagePath };
}

function getExtension(mimeType: string, fileName: string): string {
  const fromName = fileName.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName;

  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/json': 'json',
    'text/csv': 'csv',
  };
  return mimeToExt[mimeType] ?? 'bin';
}
