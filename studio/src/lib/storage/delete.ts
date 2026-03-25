/**
 * File deletion utility for Supabase Storage.
 * Removes a file from both Supabase Storage and the Files metadata table,
 * verifying ownership before deletion.
 */

import { getSupabaseClient } from '../db/client';

export class DeleteError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'STORAGE_ERROR' | 'DB_ERROR'
  ) {
    super(message);
    this.name = 'DeleteError';
  }
}

/**
 * Delete a file from Supabase Storage and remove its metadata record.
 *
 * @param fileId - UUID of the file to delete
 * @param requestingUserId - ID of the user requesting deletion
 * @param isAdmin - Skip ownership check for admin users
 */
export async function deleteFile(
  fileId: string,
  requestingUserId: string,
  isAdmin = false
): Promise<void> {
  const client = getSupabaseClient();

  // Fetch file metadata to verify ownership and get storage path
  const { data: file, error: fetchError } = await client.db.getFile(fileId);
  if (fetchError || !file) {
    throw new DeleteError(`File '${fileId}' not found`, 'NOT_FOUND');
  }

  // Ownership check: only the file owner or an admin may delete
  if (!isAdmin && file.owner_id !== requestingUserId) {
    throw new DeleteError(
      `User '${requestingUserId}' does not have permission to delete file '${fileId}'`,
      'UNAUTHORIZED'
    );
  }

  // Derive bucket and relative path from storage_path
  const bucket = extractBucket(file.storage_path);
  const relativePath = file.storage_path.slice(bucket.length + 1);

  // Delete from Supabase Storage
  const { error: storageError } = await client.storage.remove(bucket, [relativePath]);
  if (storageError) {
    throw new DeleteError(
      `Failed to delete file from storage: ${storageError.message}`,
      'STORAGE_ERROR'
    );
  }

  // Remove metadata from Files table
  const { error: dbError } = await client.db.deleteFile(fileId);
  if (dbError) {
    throw new DeleteError(
      `Failed to delete file record from database: ${dbError.message}`,
      'DB_ERROR'
    );
  }
}

function extractBucket(storagePath: string): string {
  const slashIndex = storagePath.indexOf('/');
  if (slashIndex === -1) return storagePath;
  return storagePath.slice(0, slashIndex);
}
