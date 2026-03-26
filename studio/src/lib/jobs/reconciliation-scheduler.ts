import { enqueueJob } from './enqueue';
import { logger } from '../logging/logger';

export async function enqueueHourlySubscriptionReconciliation(now: Date = new Date()): Promise<boolean> {
  if (now.getUTCMinutes() !== 0) {
    return false;
  }

  const hourKey = now.toISOString().slice(0, 13);

  await enqueueJob(
    'subscription_reconcile',
    {
      trigger: 'hourly_cron',
      hour: hourKey,
    },
    {
      aggregate_id: `subscription_reconcile:${hourKey}`,
      aggregate_type: 'subscription_reconcile',
    }
  );

  logger.info('Enqueued hourly subscription reconciliation', {
    action: 'subscription_reconciliation_enqueued',
    hour: hourKey,
  });

  return true;
}
