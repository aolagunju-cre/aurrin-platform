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

export interface MentoringResponse {
  matchAcceptanceRate: number;
  matchAcceptanceRatePercent: number;
}

export interface MonthlyMetricPoint {
  month: string;
  amountCents: number;
}

export interface RevenueResponse {
  mrr: number;
  mrrTrend: MonthlyMetricPoint[];
  churnRate: number;
  churnRateByMonth: MonthlyMetricPoint[];
  subscriptionTotals: {
    active: number;
    cancelled: number;
    total: number;
  };
}

export interface StageIndustryCohortPoint {
  value: string;
  count: number;
  averageScore: number;
  averageValidationRating: number;
}

export interface EventCohortPoint {
  eventId: string;
  eventName: string;
  date: string;
  count: number;
  averageScore: number;
  matchedWithMentorsRate: number;
  retentionToNextEventRate: number;
}

export interface CohortResponse {
  byFounderStage: StageIndustryCohortPoint[];
  byIndustry: StageIndustryCohortPoint[];
  byEventCohort: EventCohortPoint[];
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

export async function fetchMentoringMetrics(range: DateRange): Promise<MentoringResponse> {
  return getJson<MentoringResponse>('/api/admin/analytics/mentoring', range);
}

export async function fetchRevenueMetrics(range: DateRange): Promise<RevenueResponse> {
  return getJson<RevenueResponse>('/api/admin/analytics/revenue', range);
}

export async function fetchCohortMetrics(range: DateRange): Promise<CohortResponse> {
  return getJson<CohortResponse>('/api/admin/analytics/cohorts', range);
}

export async function fetchAnalyticsExport(
  type: 'csv' | 'json',
  range: DateRange
): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams();
  params.set('type', type);
  if (range.startDate) {
    params.set('startDate', range.startDate);
  }
  if (range.endDate) {
    params.set('endDate', range.endDate);
  }

  const response = await fetch(`/api/admin/analytics/export?${params.toString()}`);
  if (!response.ok) {
    let message = `Failed to export analytics report as ${type}.`;
    try {
      const payload = (await response.json()) as ApiEnvelope<never>;
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Fall back to default message when non-JSON responses are returned.
    }
    throw new Error(message);
  }

  const contentDisposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? `analytics-export.${type}`;

  return {
    blob: await response.blob(),
    filename,
  };
}
