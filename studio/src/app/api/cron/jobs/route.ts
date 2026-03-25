import { NextResponse } from 'next/server';
import { processPendingJobs } from '../../../../lib/jobs/processor';

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
    const result = await processPendingJobs();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/jobs] Unhandled error during job processing:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
