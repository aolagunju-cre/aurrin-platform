/** Enum values matching the `outbox_job_state` Postgres type in migration 001. */
export type OutboxJobState =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead_letter';

/** Job types supported by the background worker. */
export type JobType =
  | 'email'
  | 'pdf_generate'
  | 'social_asset'
  | 'export'
  | 'mentor_match'
  | 'webhook';

/** Matches the `outbox_jobs` table in migration 001_initial_schema.sql. */
export interface OutboxJob {
  id: string;
  job_type: JobType | string;
  aggregate_id: string | null;
  aggregate_type: string | null;
  payload: Record<string, unknown>;
  state: OutboxJobState;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutboxJobInsert {
  job_type: JobType | string;
  payload: Record<string, unknown>;
  aggregate_id?: string | null;
  aggregate_type?: string | null;
  scheduled_at?: string | null;
  max_retries?: number;
}

export interface JobResult {
  success: boolean;
  error?: string;
}

/** Exponential backoff delays (seconds) per retry attempt (0-indexed). */
export const RETRY_BACKOFF_SECONDS: number[] = [60, 300, 900, 1800, 3600];

/** Default max retries matching the schema default. */
export const DEFAULT_MAX_RETRIES = 3;
