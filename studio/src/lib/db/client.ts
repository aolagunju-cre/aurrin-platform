/**
 * Supabase client abstraction.
 * Provides a minimal interface for database and storage operations,
 * allowing easy mocking in tests without the Supabase SDK.
 */

import type { OutboxJob, OutboxJobInsert, OutboxJobState } from '../jobs/types';

export type { OutboxJob, OutboxJobInsert, OutboxJobState };

export interface FileRecord {
  id: string;
  owner_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  signed_url_expiry: number | null;
  retention_days: number | null;
  is_public: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface StorageUploadResult {
  path: string;
  error: Error | null;
}

export interface StorageUrlResult {
  signedUrl: string;
  error: Error | null;
}

export interface AuditLogInsert {
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  changes?: Record<string, unknown>;
  reason?: string | null;
}

export interface SupabaseStorageClient {
  upload(bucket: string, path: string, file: Buffer | Blob, options?: { contentType?: string }): Promise<StorageUploadResult>;
  remove(bucket: string, paths: string[]): Promise<{ error: Error | null }>;
  createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<StorageUrlResult>;
}

export interface SupabaseDBClient {
  insertFile(record: Omit<FileRecord, 'id' | 'created_at'>): Promise<{ data: FileRecord | null; error: Error | null }>;
  getFile(fileId: string): Promise<{ data: FileRecord | null; error: Error | null }>;
  deleteFile(fileId: string): Promise<{ error: Error | null }>;
  getExpiredFiles(beforeDate: Date): Promise<{ data: FileRecord[]; error: Error | null }>;
  insertAuditLog(log: AuditLogInsert): Promise<{ error: Error | null }>;
  insertOutboxJob(job: OutboxJobInsert): Promise<{ data: OutboxJob | null; error: Error | null }>;
  fetchPendingJobs(limit: number): Promise<{ data: OutboxJob[]; error: Error | null }>;
  updateJobState(id: string, state: OutboxJobState, updates?: Partial<Pick<OutboxJob, 'last_error' | 'retry_count' | 'scheduled_at' | 'started_at' | 'completed_at'>>): Promise<{ error: Error | null }>;
}

export interface SupabaseClient {
  storage: SupabaseStorageClient;
  db: SupabaseDBClient;
}

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Return a stub that throws descriptive errors when called
    const stub: SupabaseClient = {
      storage: {
        upload: async () => ({ path: '', error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        remove: async () => ({ error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        createSignedUrl: async () => ({ signedUrl: '', error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
      },
      db: {
        insertFile: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getFile: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        deleteFile: async () => ({ error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getExpiredFiles: async () => ({ data: [], error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        insertAuditLog: async () => ({ error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        insertOutboxJob: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        fetchPendingJobs: async () => ({ data: [], error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        updateJobState: async () => ({ error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
      },
    };
    return stub;
  }

  // Real implementation using Supabase REST API (no SDK dependency)
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const storage: SupabaseStorageClient = {
    async upload(bucket, path, file, options) {
      try {
        let requestBody: NonNullable<RequestInit['body']>;
        if (file instanceof Buffer) {
          requestBody = Uint8Array.from(file);
        } else {
          requestBody = file as Blob;
        }
        const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': options?.contentType || 'application/octet-stream',
          },
          body: requestBody,
        });
        if (!response.ok) {
          return { path: '', error: new Error(`Storage upload failed: ${response.statusText}`) };
        }
        return { path: `${bucket}/${path}`, error: null };
      } catch (err) {
        return { path: '', error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async remove(bucket, paths) {
      try {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ prefixes: paths }),
        });
        if (!response.ok) {
          return { error: new Error(`Storage delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async createSignedUrl(bucket, path, expiresIn) {
      try {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ expiresIn }),
        });
        if (!response.ok) {
          return { signedUrl: '', error: new Error(`Signed URL failed: ${response.statusText}`) };
        }
        const data = await response.json() as { signedURL: string };
        return { signedUrl: `${supabaseUrl}/storage/v1${data.signedURL}`, error: null };
      } catch (err) {
        return { signedUrl: '', error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
  };

  const db: SupabaseDBClient = {
    async insertFile(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/files`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(record),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`DB insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FileRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFile(fileId) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${fileId}&select=*`, {
          headers,
        });
        if (!response.ok) {
          return { data: null, error: new Error(`DB get failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FileRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteFile(fileId) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${fileId}`, {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) {
          return { error: new Error(`DB delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getExpiredFiles(beforeDate) {
      try {
        const iso = beforeDate.toISOString();
        const response = await fetch(
          `${supabaseUrl}/rest/v1/files?expires_at=lt.${iso}&select=*`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`DB query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FileRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertAuditLog(log) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            actor_id: log.actor_id,
            action: log.action,
            resource_type: log.resource_type,
            resource_id: log.resource_id ?? null,
            changes: log.changes ?? {},
            reason: log.reason ?? null,
          }),
        });
        if (!response.ok) {
          return { error: new Error(`Audit log insert failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertOutboxJob(job) {
      try {
        const body: Record<string, unknown> = {
          job_type: job.job_type,
          payload: job.payload,
          aggregate_id: job.aggregate_id ?? null,
          aggregate_type: job.aggregate_type ?? null,
          scheduled_at: job.scheduled_at ?? null,
          max_retries: job.max_retries ?? 3,
        };
        const response = await fetch(`${supabaseUrl}/rest/v1/outbox_jobs`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Outbox insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as OutboxJob[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async fetchPendingJobs(limit) {
      try {
        const now = new Date().toISOString();
        // Fetch pending jobs where scheduled_at is null (immediate) or in the past
        const url =
          `${supabaseUrl}/rest/v1/outbox_jobs` +
          `?state=eq.pending` +
          `&or=(scheduled_at.is.null,scheduled_at.lte.${encodeURIComponent(now)})` +
          `&order=created_at.asc` +
          `&limit=${limit}` +
          `&select=*`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Fetch pending jobs failed: ${response.statusText}`) };
        }
        const rows = await response.json() as OutboxJob[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateJobState(id, state, updates = {}) {
      try {
        const body: Record<string, unknown> = { state };
        if (updates.last_error !== undefined) body.last_error = updates.last_error;
        if (updates.retry_count !== undefined) body.retry_count = updates.retry_count;
        if (updates.scheduled_at !== undefined) body.scheduled_at = updates.scheduled_at;
        if (updates.started_at !== undefined) body.started_at = updates.started_at;
        if (updates.completed_at !== undefined) body.completed_at = updates.completed_at;
        const response = await fetch(`${supabaseUrl}/rest/v1/outbox_jobs?id=eq.${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          return { error: new Error(`Update job state failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
  };

  _client = { storage, db };
  return _client;
}

/** Override the Supabase client (for testing). */
export function setSupabaseClient(client: SupabaseClient): void {
  _client = client;
}

/** Reset the Supabase client to null (forces re-init on next call). */
export function resetSupabaseClient(): void {
  _client = null;
}
