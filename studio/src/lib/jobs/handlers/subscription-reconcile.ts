import type { JobResult } from '../types';
import { reconcileStripeSubscriptions } from '../../payments/reconciliation';
import { logger } from '../../logging/logger';

export async function handleSubscriptionReconcileJob(): Promise<JobResult> {
  try {
    const result = await reconcileStripeSubscriptions();
    logger.info('Subscription reconciliation completed', {
      action: 'subscription_reconciliation_completed',
      checked: result.checked,
      corrected: result.corrected,
      notifications_queued: result.notificationsQueued,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
