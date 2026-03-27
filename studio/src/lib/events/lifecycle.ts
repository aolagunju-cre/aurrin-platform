import { EventRecord, EventStatus } from '../db/client';

export type EventLifecycleUiStatus = 'Live' | 'Archived';

export interface LifecycleTransitionResult {
  ok: boolean;
  status?: EventStatus;
  idempotent?: boolean;
  message?: string;
}

function normalizeDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseLifecycleStatus(value: unknown): EventLifecycleUiStatus | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'live') {
    return 'Live';
  }
  if (normalized === 'archived') {
    return 'Archived';
  }

  return null;
}

export function evaluateLifecycleTransition(
  current: EventStatus,
  requested: EventLifecycleUiStatus
): LifecycleTransitionResult {
  if (requested === 'Live') {
    if (current === 'upcoming') {
      return { ok: true, status: 'live', idempotent: false };
    }
    if (current === 'live') {
      return { ok: true, status: 'live', idempotent: true };
    }
    return {
      ok: false,
      message: 'Invalid transition. Archived events cannot transition to Live.',
    };
  }

  if (current === 'live') {
    return { ok: true, status: 'archived', idempotent: false };
  }
  if (current === 'archived') {
    return { ok: true, status: 'archived', idempotent: true };
  }
  return {
    ok: false,
    message: 'Invalid transition. Only Live events can transition to Archived.',
  };
}

export function validateWindowRange(
  startRaw: unknown,
  endRaw: unknown,
  startFieldName: string,
  endFieldName: string
): { ok: true; start: string; end: string } | { ok: false; message: string } {
  if (typeof startRaw !== 'string' || Number.isNaN(Date.parse(startRaw))) {
    return { ok: false, message: `${startFieldName} must be a valid ISO date string.` };
  }

  if (typeof endRaw !== 'string' || Number.isNaN(Date.parse(endRaw))) {
    return { ok: false, message: `${endFieldName} must be a valid ISO date string.` };
  }

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (end < start) {
    return { ok: false, message: `${endFieldName} must be on or after ${startFieldName}.` };
  }

  return { ok: true, start: start.toISOString(), end: end.toISOString() };
}

export function validateScoringWindowAgainstEventBounds(
  event: EventRecord,
  scoringStartIso: string,
  scoringEndIso: string
): { ok: true } | { ok: false; message: string } {
  const eventStart = normalizeDate(event.start_date ?? event.starts_at);
  const eventEnd = normalizeDate(event.end_date ?? event.ends_at);
  const scoringStart = normalizeDate(scoringStartIso);
  const scoringEnd = normalizeDate(scoringEndIso);

  if (!eventStart || !eventEnd || !scoringStart || !scoringEnd) {
    return { ok: false, message: 'Unable to validate scoring window boundaries for this event.' };
  }

  if (scoringStart < eventStart || scoringEnd > eventEnd) {
    return {
      ok: false,
      message: 'scoring window must be within the event start_date and end_date boundaries.',
    };
  }

  return { ok: true };
}

export function ensureScoringWindowOpen(
  event: EventRecord,
  now: Date = new Date()
): { ok: true } | { ok: false; message: string } {
  const scoringStart = normalizeDate(event.scoring_start);
  const scoringEnd = normalizeDate(event.scoring_end);

  if (!scoringStart || !scoringEnd) {
    return { ok: false, message: 'Scoring window is not configured for this event.' };
  }

  if (now < scoringStart || now > scoringEnd) {
    return { ok: false, message: 'Scoring is allowed only during the configured scoring window.' };
  }

  return { ok: true };
}
