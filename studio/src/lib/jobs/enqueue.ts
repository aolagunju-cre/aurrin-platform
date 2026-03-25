import { getSupabaseClient } from '../db/client';
import type { OutboxJob, OutboxJobInsert } from './types';

/**
 * Enqueues a background job by inserting a row into the `outbox_jobs` table.
 *
 * Idempotency: callers that need idempotent enqueuing should check for existing
 * pending/processing jobs with the same aggregate_id + job_type before calling.
 *
 * @returns The created OutboxJob row, or throws on error.
 */
export async function enqueueJob(
  type: OutboxJobInsert['job_type'],
  payload: OutboxJobInsert['payload'],
  options: Omit<OutboxJobInsert, 'job_type' | 'payload'> = {}
): Promise<OutboxJob> {
  const client = getSupabaseClient();
  const { data, error } = await client.db.insertOutboxJob({
    job_type: type,
    payload,
    aggregate_id: options.aggregate_id ?? null,
    aggregate_type: options.aggregate_type ?? null,
    scheduled_at: options.scheduled_at ?? null,
    max_retries: options.max_retries,
  });

  if (error || !data) {
    throw new Error(`Failed to enqueue job of type "${type}": ${error?.message ?? 'unknown error'}`);
  }

  return data;
}
