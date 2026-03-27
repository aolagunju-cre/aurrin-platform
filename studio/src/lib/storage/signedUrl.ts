/**
 * Signed URL utility for Supabase Storage.
 * Generates time-limited access URLs after verifying file ownership.
 */

import { getSupabaseClient } from '../db/client';
import { DEFAULT_SIGNED_URL_EXPIRY, SupportedBucket } from './upload';

export class SignedUrlError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'STORAGE_ERROR'
  ) {
    super(message);
    this.name = 'SignedUrlError';
  }
}

/**
 * Generate a signed URL for a file, verifying that the requester owns it
 * or is an admin.
 *
 * @param fileId - UUID of the file record
 * @param requestingUserId - ID of the user requesting the URL
 * @param expiresIn - Expiry in seconds (defaults to per-bucket policy)
 * @param isAdmin - Skip ownership check for admin users
 * @returns Signed URL string
 */
export async function getSignedUrl(
  fileId: string,
  requestingUserId: string,
  expiresIn?: number,
  isAdmin = false
): Promise<string> {
  const client = getSupabaseClient();

  const { data: file, error: fetchError } = await client.db.getFile(fileId);
  if (fetchError || !file) {
    throw new SignedUrlError(`File '${fileId}' not found`, 'NOT_FOUND');
  }

  // Ownership check: only the file owner or an admin may get a signed URL
  if (!isAdmin && file.owner_id !== requestingUserId) {
    throw new SignedUrlError(
      `User '${requestingUserId}' does not have permission to access file '${fileId}'`,
      'UNAUTHORIZED'
    );
  }

  // Derive bucket from storage_path prefix (format: {bucket}/{userId}/...)
  const bucket = extractBucket(file.storage_path);
  const relativePath = file.storage_path.slice(bucket.length + 1); // strip "{bucket}/"

  // Use per-file expiry if stored, otherwise fall back to per-bucket default
  const resolvedExpiry = expiresIn
    ?? file.signed_url_expiry
    ?? DEFAULT_SIGNED_URL_EXPIRY[bucket as SupportedBucket]
    ?? 3600;

  const { signedUrl, error: urlError } = await client.storage.createSignedUrl(
    bucket,
    relativePath,
    resolvedExpiry
  );

  if (urlError || !signedUrl) {
    throw new SignedUrlError(
      `Failed to generate signed URL: ${urlError?.message}`,
      'STORAGE_ERROR'
    );
  }

  return signedUrl;
}

export async function getSignedUrlForEntitlement(fileId: string, expiresIn?: number): Promise<string> {
  const client = getSupabaseClient();

  const { data: file, error: fetchError } = await client.db.getFile(fileId);
  if (fetchError || !file) {
    throw new SignedUrlError(`File '${fileId}' not found`, 'NOT_FOUND');
  }

  const bucket = extractBucket(file.storage_path);
  const relativePath = file.storage_path.slice(bucket.length + 1);
  const resolvedExpiry = expiresIn
    ?? file.signed_url_expiry
    ?? DEFAULT_SIGNED_URL_EXPIRY[bucket as SupportedBucket]
    ?? 3600;

  const { signedUrl, error: urlError } = await client.storage.createSignedUrl(
    bucket,
    relativePath,
    resolvedExpiry
  );

  if (urlError || !signedUrl) {
    throw new SignedUrlError(
      `Failed to generate signed URL: ${urlError?.message}`,
      'STORAGE_ERROR'
    );
  }

  return signedUrl;
}

function extractBucket(storagePath: string): string {
  const slashIndex = storagePath.indexOf('/');
  if (slashIndex === -1) return storagePath;
  return storagePath.slice(0, slashIndex);
}
