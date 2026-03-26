export type DatePreset = 'last-30-days' | 'quarter' | 'year' | 'all-time' | 'custom';

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsKpiResponse {
  totalEvents: number;
  totalFounders: number;
  totalJudges: number;
  totalScoresSubmitted: number;
  totalValidationResponses: number;
  activeSubscriptions: number;
  mrr: number;
}

export interface HistogramPoint {
  range: string;
  count: number;
}

export interface FounderScoreTrendPoint {
  eventId: string;
  eventName: string;
  date: string;
  averageScore: number;
}

export interface ValidationParticipationPoint {
  eventId: string;
  eventName: string;
  date: string;
  founderPitches: number;
  averageScore: number;
}

export interface ValidationResponse {
  participationPerEvent: ValidationParticipationPoint[];
  ratingDistribution: HistogramPoint[];
  averageRating: number;
  totalValidationResponses: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function rangeFromPreset(preset: DatePreset, now = new Date()): DateRange {
  const endDate = toIsoDate(now);

  if (preset === 'all-time') {
    return {};
  }

  if (preset === 'last-30-days') {
    return { startDate: toIsoDate(addDays(now, -30)), endDate };
  }

  if (preset === 'quarter') {
    return { startDate: toIsoDate(addMonths(now, -3)), endDate };
  }

  if (preset === 'year') {
    return { startDate: toIsoDate(addMonths(now, -12)), endDate };
  }

  return { endDate };
}

function toQueryString(range: DateRange): string {
  const params = new URLSearchParams();
  if (range.startDate) {
    params.set('startDate', range.startDate);
  }
  if (range.endDate) {
    params.set('endDate', range.endDate);
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

async function getJson<T>(path: string, range: DateRange): Promise<T> {
  const response = await fetch(`${path}${toQueryString(range)}`);
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.message ?? `Failed to load analytics data from ${path}.`);
  }

  return payload.data;
}

export async function fetchAnalyticsKpis(range: DateRange): Promise<AnalyticsKpiResponse> {
  return getJson<AnalyticsKpiResponse>('/api/admin/analytics/kpis', range);
}

export async function fetchFounderScores(range: DateRange): Promise<{
  histogram: HistogramPoint[];
  trends: FounderScoreTrendPoint[];
}> {
  return getJson<{ histogram: HistogramPoint[]; trends: FounderScoreTrendPoint[] }>(
    '/api/admin/analytics/founder-scores',
    range
  );
}

export async function fetchValidationMetrics(range: DateRange): Promise<ValidationResponse> {
  return getJson<ValidationResponse>('/api/admin/analytics/validation', range);
}
