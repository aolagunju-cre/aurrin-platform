/**
 * Retention policy job for Supabase Storage.
 * Deletes files whose retention period has expired and records deletions
 * in the audit log. Intended to run daily via a cron job or outbox worker.
 */

import { getSupabaseClient } from '../db/client';
import { FileRecord } from '../db/client';

export interface RetentionResult {
  deletedCount: number;
  errors: Array<{ fileId: string; error: string }>;
}

/**
 * Run the file retention policy: delete files whose `expires_at` is in the
 * past or whose `retention_days` have elapsed since `created_at`.
 *
 * For each deleted file the event is written to AuditLogs for traceability.
 *
 * @param systemUserId - Actor ID used in audit log entries
 * @returns Summary with count of deleted files and any per-file errors
 */
export async function runRetentionPolicy(systemUserId: string): Promise<RetentionResult> {
  const client = getSupabaseClient();
  const now = new Date();

  const { data: expiredFiles, error: queryError } = await client.db.getExpiredFiles(now);
  if (queryError) {
    throw new Error(`Failed to query expired files: ${queryError.message}`);
  }

  const result: RetentionResult = { deletedCount: 0, errors: [] };

  for (const file of expiredFiles) {
    const fileError = await processRetentionDeletion(client, file, systemUserId);
    if (fileError) {
      result.errors.push({ fileId: file.id, error: fileError });
    } else {
      result.deletedCount++;
    }
  }

  return result;
}

async function processRetentionDeletion(
  client: ReturnType<typeof getSupabaseClient>,
  file: FileRecord,
  systemUserId: string
): Promise<string | null> {
  const bucket = extractBucket(file.storage_path);
  const relativePath = file.storage_path.slice(bucket.length + 1);

  // Delete from Supabase Storage
  const { error: storageError } = await client.storage.remove(bucket, [relativePath]);
  if (storageError) {
    return `Storage removal failed: ${storageError.message}`;
  }

  // Delete from Files table
  const { error: dbError } = await client.db.deleteFile(file.id);
  if (dbError) {
    return `DB deletion failed: ${dbError.message}`;
  }

  // Write audit log entry
  const { error: auditError } = await client.db.insertAuditLog({
    actor_id: systemUserId,
    action: 'retention_delete',
    resource_type: 'file',
    resource_id: file.id,
    changes: {
      before: {
        file_id: file.id,
        file_name: file.file_name,
        storage_path: file.storage_path,
        owner_id: file.owner_id,
      },
      after: null,
    },
    reason: 'Retention policy: file expired',
  });
  if (auditError) {
    return `Audit log insert failed: ${auditError.message}`;
  }

  return null;
}

/**
 * Malware scanning stub — placeholder for Phase 2 integration.
 * Returns 'safe' until a real scanner (e.g. VirusTotal) is wired in.
 *
 * @param filePath - Storage path of the file to scan
 */
export async function scanFile(filePath: string): Promise<'safe' | 'unsafe'> {
  // Phase 2: integrate with VirusTotal or ClamAV
  void filePath;
  return 'safe';
}

function extractBucket(storagePath: string): string {
  const slashIndex = storagePath.indexOf('/');
  if (slashIndex === -1) return storagePath;
  return storagePath.slice(0, slashIndex);
}
