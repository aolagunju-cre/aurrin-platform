import { getSupabaseClient } from '../db/client';
import { enqueueJob } from '../jobs/enqueue';

interface EligibleEvent {
  id: string;
  name: string;
  publishing_start: string | null;
}

interface FounderPitchRecipient {
  founder_id: string;
  event_id: string;
  founder: {
    company_name: string | null;
    user: {
      email: string | null;
      name: string | null;
    } | null;
  } | null;
}

interface ExistingNotificationJob {
  aggregate_id: string | null;
}

function buildAggregateId(eventId: string, founderId: string): string {
  return `${eventId}:${founderId}`;
}

function compact(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveFounderPortalBaseUrl(): string {
  const candidate =
    process.env.APP_BASE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (candidate) {
    return candidate.replace(/\/+$/, '');
  }
  return 'https://app.aurrin.ventures';
}

export async function enqueueScorePublishNotifications(now: Date = new Date()): Promise<number> {
  const client = getSupabaseClient();
  const nowIso = now.toISOString();
  const founderPortalBaseUrl = resolveFounderPortalBaseUrl();

  const eventsResult = await client.db.queryTable<EligibleEvent>(
    'events',
    `publishing_start=lte.${encodeURIComponent(nowIso)}&select=id,name,publishing_start&order=publishing_start.asc&limit=500`
  );
  if (eventsResult.error) {
    throw new Error(`Failed to load events ready for score publishing notifications: ${eventsResult.error.message}`);
  }

  let queued = 0;
  for (const event of eventsResult.data) {
    const recipientsResult = await client.db.queryTable<FounderPitchRecipient>(
      'founder_pitches',
      `event_id=eq.${encodeURIComponent(event.id)}&select=event_id,founder_id,founder:founders!founder_pitches_founder_id_fkey(company_name,user:users!founders_user_id_fkey(email,name))&limit=2000`
    );
    if (recipientsResult.error) {
      throw new Error(`Failed to load founder recipients for event ${event.id}: ${recipientsResult.error.message}`);
    }

    const recipients = recipientsResult.data
      .map((record) => ({
        founderId: record.founder_id,
        to: compact(record.founder?.user?.email),
        name: compact(record.founder?.user?.name),
        company: compact(record.founder?.company_name),
      }))
      .filter((record): record is { founderId: string; to: string; name: string | null; company: string | null } => Boolean(record.to));

    if (recipients.length === 0) {
      continue;
    }

    const aggregateIds = recipients.map((recipient) => buildAggregateId(event.id, recipient.founderId));
    const encodedAggregateIds = aggregateIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
    const existingJobsResult = await client.db.queryTable<ExistingNotificationJob>(
      'outbox_jobs',
      `aggregate_type=eq.scores_published_notification&aggregate_id=in.(${encodeURIComponent(encodedAggregateIds)})&select=aggregate_id&limit=5000`
    );
    if (existingJobsResult.error) {
      throw new Error(`Failed to load existing score publish notification jobs for event ${event.id}: ${existingJobsResult.error.message}`);
    }

    const existingAggregateIds = new Set(
      existingJobsResult.data
        .map((job) => compact(job.aggregate_id))
        .filter((value): value is string => Boolean(value))
    );

    for (const recipient of recipients) {
      const aggregateId = buildAggregateId(event.id, recipient.founderId);
      if (existingAggregateIds.has(aggregateId)) {
        continue;
      }

      await enqueueJob(
        'send_email',
        {
          to: recipient.to,
          template_name: 'scores_published',
          data: {
            name: recipient.name ?? 'Founder',
            company: recipient.company ?? 'your company',
            date: event.publishing_start ?? nowIso,
            link: `${founderPortalBaseUrl}/founder/events/${event.id}/pitch`,
            eventSummary: event.name,
          },
        },
        {
          aggregate_id: aggregateId,
          aggregate_type: 'scores_published_notification',
        }
      );
      queued += 1;
    }
  }

  return queued;
}
