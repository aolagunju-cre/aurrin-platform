/**
 * Supabase client abstraction.
 * Provides a minimal interface for database and storage operations,
 * allowing easy mocking in tests without the Supabase SDK.
 */

import type { OutboxJob, OutboxJobInsert, OutboxJobState } from '../jobs/types';
import type {
  RubricDefinition,
  RubricTemplateRecord,
  RubricVersionRecord,
} from '../rubrics/types';

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

export interface FounderApplicationRecord {
  id: string;
  email: string;
  name: string;
  full_name: string | null;
  company_name: string | null;
  pitch_summary: string | null;
  industry: string | null;
  stage: string | null;
  deck_file_id: string | null;
  deck_path: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  status: 'pending' | 'accepted' | 'assigned' | 'declined';
  assigned_event_id: string | null;
  application_data: Record<string, unknown> | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FounderApplicationInsert {
  email: string;
  name: string;
  full_name?: string | null;
  company_name?: string | null;
  pitch_summary?: string | null;
  industry?: string | null;
  stage?: string | null;
  deck_file_id?: string | null;
  deck_path?: string | null;
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  assigned_event_id?: string | null;
  status?: 'pending' | 'accepted' | 'assigned' | 'declined';
  application_data?: Record<string, unknown>;
}

export interface FounderApplicationUpdate {
  name?: string;
  full_name?: string | null;
  company_name?: string | null;
  pitch_summary?: string | null;
  industry?: string | null;
  stage?: string | null;
  deck_file_id?: string | null;
  deck_path?: string | null;
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  status?: 'pending' | 'accepted' | 'assigned' | 'declined';
  assigned_event_id?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  application_data?: Record<string, unknown>;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FounderRecord {
  id: string;
  user_id: string;
  company_name: string | null;
  tagline: string | null;
  bio: string | null;
  website: string | null;
  pitch_deck_url: string | null;
  social_proof: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RoleAssignmentRecord {
  id: string;
  user_id: string;
  role: string;
  scope: string;
  scoped_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UserInsert {
  email: string;
  name?: string | null;
}

export interface FounderInsert {
  user_id: string;
  company_name?: string | null;
  website?: string | null;
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

export interface RubricTemplateInsert {
  name: string;
  description?: string | null;
}

export interface RubricTemplateUpdate {
  name?: string;
  description?: string | null;
}

export interface RubricVersionInsert {
  rubric_template_id: string;
  version: number;
  definition: RubricDefinition;
  event_id?: string | null;
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
  getFounderApplicationById(id: string): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  getFounderApplicationByEmail(email: string): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  insertFounderApplication(record: FounderApplicationInsert): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  updateFounderApplication(id: string, updates: FounderApplicationUpdate): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  getUserByEmail(email: string): Promise<{ data: UserRecord | null; error: Error | null }>;
  insertUser(record: UserInsert): Promise<{ data: UserRecord | null; error: Error | null }>;
  getFounderByUserId(userId: string): Promise<{ data: FounderRecord | null; error: Error | null }>;
  insertFounder(record: FounderInsert): Promise<{ data: FounderRecord | null; error: Error | null }>;
  getRoleAssignmentsByUserId(userId: string): Promise<{ data: RoleAssignmentRecord[]; error: Error | null }>;
  listRubricTemplates(): Promise<{ data: RubricTemplateRecord[]; error: Error | null }>;
  getRubricTemplateById(id: string): Promise<{ data: RubricTemplateRecord | null; error: Error | null }>;
  insertRubricTemplate(record: RubricTemplateInsert): Promise<{ data: RubricTemplateRecord | null; error: Error | null }>;
  updateRubricTemplate(id: string, updates: RubricTemplateUpdate): Promise<{ data: RubricTemplateRecord | null; error: Error | null }>;
  listRubricVersionsByTemplateId(templateId: string): Promise<{ data: RubricVersionRecord[]; error: Error | null }>;
  getLatestRubricVersionByTemplateId(templateId: string): Promise<{ data: RubricVersionRecord | null; error: Error | null }>;
  insertRubricVersion(record: RubricVersionInsert): Promise<{ data: RubricVersionRecord | null; error: Error | null }>;
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
        getFounderApplicationById: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getFounderApplicationByEmail: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        insertFounderApplication: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        updateFounderApplication: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getUserByEmail: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        insertUser: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getFounderByUserId: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        insertFounder: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getRoleAssignmentsByUserId: async () => ({ data: [], error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        listRubricTemplates: async () => ({ data: [], error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getRubricTemplateById: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        insertRubricTemplate: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        updateRubricTemplate: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        listRubricVersionsByTemplateId: async () => ({ data: [], error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        getLatestRubricVersionByTemplateId: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
        insertRubricVersion: async () => ({ data: null, error: new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set') }),
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

    async getFounderApplicationById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_applications?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFounderApplicationByEmail(email) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_applications?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertFounderApplication(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/founder_applications`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            email: record.email,
            name: record.name,
            full_name: record.full_name ?? record.name,
            company_name: record.company_name ?? null,
            pitch_summary: record.pitch_summary ?? null,
            industry: record.industry ?? null,
            stage: record.stage ?? null,
            deck_file_id: record.deck_file_id ?? null,
            deck_path: record.deck_path ?? null,
            website: record.website ?? null,
            twitter: record.twitter ?? null,
            linkedin: record.linkedin ?? null,
            status: record.status ?? 'pending',
            assigned_event_id: record.assigned_event_id ?? null,
            application_data: record.application_data ?? {},
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateFounderApplication(id, updates) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_applications?id=eq.${encodeURIComponent(id)}`,
          {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(updates),
          }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getUserByEmail(email) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`User query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as UserRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertUser(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            email: record.email,
            name: record.name ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`User insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as UserRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFounderByUserId(userId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founders?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertFounder(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/founders`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: record.user_id,
            company_name: record.company_name ?? null,
            website: record.website ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Founder insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getRoleAssignmentsByUserId(userId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/role_assignments?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=100`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Role assignments query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RoleAssignmentRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listRubricTemplates() {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_templates?select=*&order=updated_at.desc`, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Rubric templates query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getRubricTemplateById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rubric_templates?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric template query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertRubricTemplate(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_templates`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            name: record.name,
            description: record.description ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric template insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateRubricTemplate(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_templates?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric template update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listRubricVersionsByTemplateId(templateId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rubric_versions?rubric_template_id=eq.${encodeURIComponent(templateId)}&select=*&order=version.desc`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Rubric versions query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricVersionRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getLatestRubricVersionByTemplateId(templateId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rubric_versions?rubric_template_id=eq.${encodeURIComponent(templateId)}&select=*&order=version.desc&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric version query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricVersionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertRubricVersion(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_versions`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            rubric_template_id: record.rubric_template_id,
            version: record.version,
            event_id: record.event_id ?? null,
            definition: record.definition,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric version insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricVersionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
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
