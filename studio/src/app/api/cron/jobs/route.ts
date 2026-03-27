import { NextResponse } from 'next/server';
import { processPendingJobs } from '../../../../lib/jobs/processor';
import { enqueueHourlySubscriptionReconciliation } from '../../../../lib/jobs/reconciliation-scheduler';
import { getSupabaseClient } from '../../../../lib/db/client';
import { enqueueScorePublishNotifications } from '../../../../lib/events/score-publish-notifications';

/**
 * Cron route: GET /api/cron/jobs
 * Triggered by Vercel Cron every 5 minutes to process pending outbox jobs.
 * Protected by CRON_SECRET to prevent unauthorized invocation.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify cron secret when set (Vercel injects Authorization header automatically)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    let expiredAudienceSessionsDeleted = 0;
    let scoresPublishedNotificationsQueued = 0;
    try {
      const cleanup = await getSupabaseClient().db.deleteExpiredAudienceSessions(new Date());
      if (cleanup.error) {
        console.error('[cron/jobs] Failed to cleanup expired audience sessions:', cleanup.error);
      } else {
        expiredAudienceSessionsDeleted = cleanup.deleted;
      }
    } catch (error) {
      console.error('[cron/jobs] Failed to cleanup expired audience sessions:', error);
    }

    try {
      await enqueueHourlySubscriptionReconciliation();
    } catch (error) {
      console.error('[cron/jobs] Failed to enqueue subscription reconciliation job:', error);
    }

    try {
      scoresPublishedNotificationsQueued = await enqueueScorePublishNotifications(new Date());
    } catch (error) {
      console.error('[cron/jobs] Failed to enqueue score publishing notifications:', error);
    }

    const result = await processPendingJobs();
    return NextResponse.json({ ok: true, expiredAudienceSessionsDeleted, scoresPublishedNotificationsQueued, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/jobs] Unhandled error during job processing:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
