import { getSupabaseClient } from '../../db/client';
import { enqueueJob } from '../enqueue';
import type { JobResult } from '../types';

interface MentorMatchPayload {
  match_id?: unknown;
  event_id?: unknown;
  founder_id?: unknown;
  reason?: unknown;
}

interface MentorMatchRow {
  id: string;
  mentor_id: string;
  founder_id: string;
  event_id: string | null;
  mentor_status: 'pending' | 'accepted' | 'declined';
  founder_status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

interface FounderRow {
  id: string;
  user_id: string;
  company_name: string | null;
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function addDaysIso(value: string, days: number): string | null {
  const parsed = parseDate(value);
  if (!parsed) {
    return null;
  }
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

function isPublishingOpen(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const parsed = parseDate(value);
  if (!parsed) {
    return false;
  }
  return Date.now() >= parsed.getTime();
}

async function getMatchFromPayload(payload: MentorMatchPayload): Promise<{ match: MentorMatchRow | null; error: string | null }> {
  const client = getSupabaseClient();

  if (typeof payload.match_id === 'string' && payload.match_id.trim().length > 0) {
    const result = await client.db.getMentorMatchById(payload.match_id);
    if (result.error) {
      return { match: null, error: result.error.message };
    }
    return { match: result.data as MentorMatchRow | null, error: null };
  }

  if (typeof payload.event_id !== 'string' || typeof payload.founder_id !== 'string') {
    return { match: null, error: 'Mentor match job missing required fields: match_id or event_id/founder_id' };
  }

  const query = [
    `event_id=eq.${encodeURIComponent(payload.event_id)}`,
    `founder_id=eq.${encodeURIComponent(payload.founder_id)}`,
    'select=id,mentor_id,founder_id,event_id,mentor_status,founder_status,created_at',
    'order=created_at.desc',
    'limit=1',
  ].join('&');
  const result = await client.db.queryTable<MentorMatchRow>('mentor_matches', query);
  if (result.error) {
    return { match: null, error: result.error.message };
  }

  return { match: result.data[0] ?? null, error: null };
}

export async function handleMentorMatchJob(rawPayload: Record<string, unknown>): Promise<JobResult> {
  const payload = rawPayload as MentorMatchPayload;
  const { match, error } = await getMatchFromPayload(payload);
  if (error) {
    return { success: false, error };
  }
  if (!match) {
    return { success: true };
  }

  const client = getSupabaseClient();
  const mentorResult = await client.db.getUserById(match.mentor_id);
  if (mentorResult.error || !mentorResult.data) {
    return { success: false, error: mentorResult.error?.message ?? 'Mentor user not found.' };
  }

  const founderResult = await client.db.queryTable<FounderRow>(
    'founders',
    `id=eq.${encodeURIComponent(match.founder_id)}&select=id,user_id,company_name&limit=1`
  );
  if (founderResult.error || founderResult.data.length === 0) {
    return { success: false, error: founderResult.error?.message ?? 'Founder not found.' };
  }
  const founder = founderResult.data[0];

  const founderUserResult = await client.db.getUserById(founder.user_id);
  if (founderUserResult.error || !founderUserResult.data) {
    return { success: false, error: founderUserResult.error?.message ?? 'Founder user not found.' };
  }

  const eventResult = match.event_id ? await client.db.getEventById(match.event_id) : { data: null, error: null };
  if (eventResult.error) {
    return { success: false, error: eventResult.error.message };
  }

  const mentorName = mentorResult.data.name ?? 'Mentor';
  const founderName = founderUserResult.data.name ?? founder.company_name ?? 'Founder';
  const founderCompany = founder.company_name ?? founderName;
  const mentorLink = `{baseUrl}/mentor/matches/${match.id}`;
  const founderLink = `{baseUrl}/founder`;
  const reminderAt = addDaysIso(match.created_at, 7);
  const founderVisible = isPublishingOpen(eventResult.data?.publishing_start ?? null);

  const isMutualAcceptance = match.mentor_status === 'accepted' && match.founder_status === 'accepted';
  if (isMutualAcceptance) {
    const introSubject = `Mentor ${mentorName}, meet Founder ${founderName}`;
    await enqueueJob('send_email', {
      to: mentorResult.data.email,
      template_name: 'match_accepted',
      data: {
        subject: introSubject,
        mentor_name: mentorName,
        mentor_email: mentorResult.data.email,
        founder_name: founderName,
        founder_email: founderUserResult.data.email,
        company: founderCompany,
        link: mentorLink,
      },
    }, { aggregate_id: match.id, aggregate_type: 'mentor_match' });
    await enqueueJob('send_email', {
      to: founderUserResult.data.email,
      template_name: 'match_accepted',
      data: {
        subject: introSubject,
        mentor_name: mentorName,
        mentor_email: mentorResult.data.email,
        founder_name: founderName,
        founder_email: founderUserResult.data.email,
        company: founderCompany,
        link: founderLink,
      },
    }, { aggregate_id: match.id, aggregate_type: 'mentor_match' });
    return { success: true };
  }

  if (match.mentor_status === 'pending') {
    await enqueueJob('send_email', {
      to: mentorResult.data.email,
      template_name: 'mentor_match_created',
      data: {
        founder_name: founderName,
        company: founderCompany,
        link: mentorLink,
      },
    }, { aggregate_id: match.id, aggregate_type: 'mentor_match' });

    if (reminderAt) {
      await enqueueJob('send_email', {
        to: mentorResult.data.email,
        template_name: 'match_reminder',
        data: {
          recipient_role: 'mentor',
          founder_name: founderName,
          mentor_name: mentorName,
          company: founderCompany,
          link: mentorLink,
        },
      }, { aggregate_id: match.id, aggregate_type: 'mentor_match', scheduled_at: reminderAt });
    }
  }

  if (match.founder_status === 'pending' && founderVisible) {
    await enqueueJob('send_email', {
      to: founderUserResult.data.email,
      template_name: 'founder_match_created',
      data: {
        mentor_name: mentorName,
        company: founderCompany,
        link: founderLink,
      },
    }, { aggregate_id: match.id, aggregate_type: 'mentor_match' });

    if (reminderAt) {
      await enqueueJob('send_email', {
        to: founderUserResult.data.email,
        template_name: 'match_reminder',
        data: {
          recipient_role: 'founder',
          founder_name: founderName,
          mentor_name: mentorName,
          company: founderCompany,
          link: founderLink,
        },
      }, { aggregate_id: match.id, aggregate_type: 'mentor_match', scheduled_at: reminderAt });
    }
  }

  return { success: true };
}
