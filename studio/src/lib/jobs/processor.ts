import { getSupabaseClient } from '../db/client';
import type { OutboxJob, JobResult } from './types';
import { RETRY_BACKOFF_SECONDS } from './types';
import { handleEmailJob } from './handlers/email';
import { handlePdfJob } from './handlers/pdf';
import { handleAssetJob } from './handlers/asset';
import { handleMentorMatchJob } from './handlers/mentor-match';
import { handleWebhookJob } from './handlers/webhook';

const BATCH_SIZE = 10;

/** Dispatch a job to the appropriate handler based on its type. */
async function dispatchJob(job: OutboxJob): Promise<JobResult> {
  switch (job.job_type) {
    case 'send_email':
    case 'email':
      return handleEmailJob(job.payload);
    case 'pdf_generate':
      return handlePdfJob(job.payload);
    case 'social_asset':
      return handleAssetJob(job.payload);
    case 'mentor_match':
      return handleMentorMatchJob(job.payload);
    case 'webhook':
      return handleWebhookJob(job.payload);
    default:
      return { success: false, error: `Unknown job type: ${job.job_type}` };
  }
}

/** Calculate the next retry timestamp using exponential backoff. */
function nextRetryAt(retryCount: number): string {
  const delaySecs = RETRY_BACKOFF_SECONDS[retryCount] ?? RETRY_BACKOFF_SECONDS[RETRY_BACKOFF_SECONDS.length - 1];
  return new Date(Date.now() + delaySecs * 1000).toISOString();
}

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  dead: number;
}

/**
 * Polls for pending jobs and processes them in a single batch.
 * Called by the cron route on each tick.
 */
export async function processPendingJobs(): Promise<ProcessResult> {
  const client = getSupabaseClient();
  const stats: ProcessResult = { processed: 0, succeeded: 0, failed: 0, dead: 0 };

  const { data: jobs, error } = await client.db.fetchPendingJobs(BATCH_SIZE);
  if (error) {
    console.error('[jobs/processor] Failed to fetch pending jobs:', error.message);
    return stats;
  }

  for (const job of jobs) {
    stats.processed++;
    const startedAt = new Date().toISOString();

    // Mark as processing
    await client.db.updateJobState(job.id, 'processing', { started_at: startedAt });

    console.log(`[jobs/processor] Starting job ${job.id} type=${job.job_type} retry=${job.retry_count}`);

    let result: JobResult;
    try {
      result = await dispatchJob(job);
    } catch (err) {
      result = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    if (result.success) {
      await client.db.updateJobState(job.id, 'completed', {
        completed_at: new Date().toISOString(),
        email_id: result.email_id ?? null,
        error_message: null,
      });
      stats.succeeded++;
      console.log(`[jobs/processor] Job ${job.id} completed`);
    } else {
      const newRetryCount = job.retry_count + 1;
      const maxRetries = job.max_retries ?? 3;

      if (newRetryCount >= maxRetries) {
        await client.db.updateJobState(job.id, 'dead_letter', {
          last_error: result.error ?? 'Unknown error',
          error_message: result.error ?? 'Unknown error',
          retry_count: newRetryCount,
        });
        stats.dead++;
        console.error(`[jobs/processor] Job ${job.id} moved to dead_letter after ${newRetryCount} retries`);
      } else {
        await client.db.updateJobState(job.id, 'failed', {
          last_error: result.error ?? 'Unknown error',
          error_message: result.error ?? 'Unknown error',
          retry_count: newRetryCount,
          scheduled_at: nextRetryAt(newRetryCount),
        });
        stats.failed++;
        console.warn(`[jobs/processor] Job ${job.id} failed (attempt ${newRetryCount}), scheduled for retry`);
      }
    }
  }

  return stats;
}
