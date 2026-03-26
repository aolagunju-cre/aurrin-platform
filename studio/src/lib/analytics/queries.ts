import { getSupabaseClient } from '../db/client';

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

type DateLike = string | Date;

export interface AnalyticsDateRange {
  startDate?: DateLike;
  endDate?: DateLike;
}

export interface AnalyticsQueryOptions extends AnalyticsDateRange {
  bypassCache?: boolean;
  now?: number;
}

export interface KpiAggregates {
  eventCount: number;
  founderCount: number;
  judgeCount: number;
  totalScores: number;
  validationResponses: number;
  matchSuccessRate: number;
  revenueCents: number;
  activeSubscriptions: number;
  subscriptionChurnRate: number;
}

export interface ScoreDistributionBin {
  label: '0-20' | '20-40' | '40-60' | '60-80' | '80-100';
  min: number;
  max: number;
  count: number;
}

export interface EventTimeSeriesPoint {
  date: string;
  eventId: string;
  eventName: string;
  pitchCount: number;
  averageScore: number;
}

export interface CohortBucket {
  value: string;
  count: number;
}

export interface EventCohortBucket {
  eventId: string;
  count: number;
  averageScore: number;
}

export interface CohortAggregates {
  byFounderStage: CohortBucket[];
  byIndustry: CohortBucket[];
  byEventCohort: EventCohortBucket[];
}

export interface MonthlyAggregate {
  month: string;
  amountCents: number;
}

export interface RevenueChurnAggregates {
  totalRevenueCents: number;
  mrrCents: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  churnRate: number;
  revenueByMonth: MonthlyAggregate[];
  churnByMonth: MonthlyAggregate[];
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

interface EventRow {
  id: string;
  name: string;
  starts_at: string | null;
  created_at: string;
}

interface FounderRow {
  id: string;
}

interface RoleAssignmentRow {
  user_id: string;
  role: string;
}

interface JudgeScoreRow {
  id: string;
  is_submitted: boolean | null;
}

interface AudienceResponseRow {
  id: string;
}

interface MentorMatchRow {
  id: string;
  status: string | null;
}

interface SubscriptionRow {
  id: string;
  status: string;
  created_at: string;
  cancel_at?: string | null;
  canceled_at?: string | null;
}

interface TransactionRow {
  id: string;
  amount_cents: number | null;
  status: string | null;
  created_at: string;
}

interface FounderPitchRow {
  id: string;
  event_id: string;
  score_aggregate: number | string | null;
  created_at: string;
}

interface FounderApplicationRow {
  id: string;
  stage: string | null;
  industry: string | null;
}

const analyticsCache = new Map<string, CacheEntry>();

function toIsoString(value: DateLike): string {
  return value instanceof Date ? value.toISOString() : value;
}

function addDateRangeParams(params: URLSearchParams, column: string, range: AnalyticsDateRange): void {
  if (range.startDate) {
    params.append(`${column}`, `gte.${toIsoString(range.startDate)}`);
  }
  if (range.endDate) {
    params.append(`${column}`, `lte.${toIsoString(range.endDate)}`);
  }
}

function bucketScore(score: number): ScoreDistributionBin['label'] {
  if (score <= 20) {
    return '0-20';
  }
  if (score <= 40) {
    return '20-40';
  }
  if (score <= 60) {
    return '40-60';
  }
  if (score <= 80) {
    return '60-80';
  }
  return '80-100';
}

function toSafeNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function monthKey(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function queryTable<T>(
  table: string,
  select: string,
  range: AnalyticsDateRange,
  dateColumn = 'created_at',
  extras?: (params: URLSearchParams) => void
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set('select', select);
  addDateRangeParams(params, dateColumn, range);
  if (extras) {
    extras(params);
  }

  const client = getSupabaseClient();
  const result = await client.db.queryTable<T>(table, params.toString());
  if (result.error) {
    throw result.error;
  }
  return result.data;
}

async function withAnalyticsCache<T>(
  key: string,
  options: AnalyticsQueryOptions,
  load: () => Promise<T>
): Promise<T> {
  if (options.bypassCache) {
    return load();
  }

  const now = options.now ?? Date.now();
  const current = analyticsCache.get(key);
  if (current && now < current.expiresAt) {
    return current.value as T;
  }

  const value = await load();
  analyticsCache.set(key, {
    value,
    expiresAt: now + ANALYTICS_CACHE_TTL_MS,
  });

  return value;
}

function buildCacheKey(name: string, options: AnalyticsQueryOptions): string {
  const startDate = options.startDate ? toIsoString(options.startDate) : 'none';
  const endDate = options.endDate ? toIsoString(options.endDate) : 'none';
  return `${name}:${startDate}:${endDate}`;
}

// SQL/index note: analytics filters intentionally target timestamp/status/category-like fields
// already indexed in existing migrations (e.g., events.status/starts_at, audience_responses.created_at,
// mentor_matches.status, subscriptions.status, transactions.created_at).

export async function getKpiBaseAggregates(options: AnalyticsQueryOptions = {}): Promise<KpiAggregates> {
  return withAnalyticsCache(buildCacheKey('kpis', options), options, async () => {
    const [events, founders, roleAssignments, judgeScores, audienceResponses, mentorMatches, subscriptions, transactions] =
      await Promise.all([
        queryTable<EventRow>('events', 'id,name,starts_at,created_at', options, 'starts_at'),
        queryTable<FounderRow>('founders', 'id', options),
        queryTable<RoleAssignmentRow>('role_assignments', 'user_id,role', options),
        queryTable<JudgeScoreRow>('judge_scores', 'id,is_submitted', options),
        queryTable<AudienceResponseRow>('audience_responses', 'id', options),
        queryTable<MentorMatchRow>('mentor_matches', 'id,status', options),
        queryTable<SubscriptionRow>('subscriptions', 'id,status,cancel_at,canceled_at,created_at', options),
        queryTable<TransactionRow>('transactions', 'id,amount_cents,status,created_at', options),
      ]);

    const uniqueJudges = new Set(roleAssignments.filter((row) => row.role === 'judge').map((row) => row.user_id));
    const submittedScores = judgeScores.filter((row) => row.is_submitted !== false).length;
    const successfulMatches = mentorMatches.filter((row) => row.status === 'accepted').length;
    const succeededTransactions = transactions.filter((row) => row.status === 'succeeded');
    const revenueCents = succeededTransactions.reduce((sum, row) => sum + toSafeNumber(row.amount_cents), 0);
    const activeSubscriptions = subscriptions.filter((row) => row.status === 'active').length;
    const cancelledSubscriptions = subscriptions.filter((row) => row.status === 'cancelled').length;

    return {
      eventCount: events.length,
      founderCount: founders.length,
      judgeCount: uniqueJudges.size,
      totalScores: submittedScores,
      validationResponses: audienceResponses.length,
      matchSuccessRate: mentorMatches.length === 0 ? 0 : successfulMatches / mentorMatches.length,
      revenueCents,
      activeSubscriptions,
      subscriptionChurnRate: subscriptions.length === 0 ? 0 : cancelledSubscriptions / subscriptions.length,
    };
  });
}

export async function getScoreDistribution(options: AnalyticsQueryOptions = {}): Promise<ScoreDistributionBin[]> {
  return withAnalyticsCache(buildCacheKey('score-distribution', options), options, async () => {
    const rows = await queryTable<FounderPitchRow>(
      'founder_pitches',
      'id,score_aggregate,event_id,created_at',
      options
    );

    const bins: ScoreDistributionBin[] = [
      { label: '0-20', min: 0, max: 20, count: 0 },
      { label: '20-40', min: 20, max: 40, count: 0 },
      { label: '40-60', min: 40, max: 60, count: 0 },
      { label: '60-80', min: 60, max: 80, count: 0 },
      { label: '80-100', min: 80, max: 100, count: 0 },
    ];

    const binMap = new Map(bins.map((bin) => [bin.label, bin]));

    for (const row of rows) {
      const score = toSafeNumber(row.score_aggregate);
      if (score < 0 || score > 100) {
        continue;
      }
      const bucket = bucketScore(score);
      const entry = binMap.get(bucket);
      if (entry) {
        entry.count += 1;
      }
    }

    return bins;
  });
}

export async function getEventTimeSeries(options: AnalyticsQueryOptions = {}): Promise<EventTimeSeriesPoint[]> {
  return withAnalyticsCache(buildCacheKey('event-time-series', options), options, async () => {
    const [events, founderPitches] = await Promise.all([
      queryTable<EventRow>('events', 'id,name,starts_at,created_at', options, 'starts_at'),
      queryTable<FounderPitchRow>('founder_pitches', 'id,event_id,score_aggregate,created_at', options),
    ]);

    const pitchMap = new Map<string, number[]>();
    for (const pitch of founderPitches) {
      const score = toSafeNumber(pitch.score_aggregate);
      if (!pitchMap.has(pitch.event_id)) {
        pitchMap.set(pitch.event_id, []);
      }
      if (score >= 0 && score <= 100) {
        pitchMap.get(pitch.event_id)?.push(score);
      }
    }

    return events
      .map((event) => {
        const scores = pitchMap.get(event.id) ?? [];
        const date = event.starts_at ?? event.created_at;
        return {
          date,
          eventId: event.id,
          eventName: event.name,
          pitchCount: scores.length,
          averageScore: average(scores),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

export async function getCohortAggregates(options: AnalyticsQueryOptions = {}): Promise<CohortAggregates> {
  return withAnalyticsCache(buildCacheKey('cohorts', options), options, async () => {
    const [applications, founderPitches] = await Promise.all([
      queryTable<FounderApplicationRow>('founder_applications', 'id,stage,industry', options),
      queryTable<FounderPitchRow>('founder_pitches', 'id,event_id,score_aggregate,created_at', options),
    ]);

    const byStage = new Map<string, number>();
    const byIndustry = new Map<string, number>();

    for (const application of applications) {
      const stage = (application.stage ?? 'unspecified').trim() || 'unspecified';
      const industry = (application.industry ?? 'unspecified').trim() || 'unspecified';
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
      byIndustry.set(industry, (byIndustry.get(industry) ?? 0) + 1);
    }

    const eventScores = new Map<string, number[]>();
    for (const pitch of founderPitches) {
      if (!eventScores.has(pitch.event_id)) {
        eventScores.set(pitch.event_id, []);
      }
      eventScores.get(pitch.event_id)?.push(toSafeNumber(pitch.score_aggregate));
    }

    return {
      byFounderStage: [...byStage.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      byIndustry: [...byIndustry.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      byEventCohort: [...eventScores.entries()]
        .map(([eventId, scores]) => ({
          eventId,
          count: scores.length,
          averageScore: average(scores.filter((score) => score >= 0 && score <= 100)),
        }))
        .sort((a, b) => b.count - a.count),
    };
  });
}

export async function getRevenueChurnAggregates(options: AnalyticsQueryOptions = {}): Promise<RevenueChurnAggregates> {
  return withAnalyticsCache(buildCacheKey('revenue-churn', options), options, async () => {
    const [subscriptions, transactions] = await Promise.all([
      queryTable<SubscriptionRow>('subscriptions', 'id,status,cancel_at,canceled_at,created_at', options),
      queryTable<TransactionRow>('transactions', 'id,amount_cents,status,created_at', options),
    ]);

    const revenueByMonthMap = new Map<string, number>();
    const churnByMonthMap = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.status !== 'succeeded') {
        continue;
      }
      const key = monthKey(transaction.created_at);
      revenueByMonthMap.set(key, (revenueByMonthMap.get(key) ?? 0) + toSafeNumber(transaction.amount_cents));
    }

    for (const subscription of subscriptions) {
      const cancelledAt = subscription.cancel_at ?? subscription.canceled_at;
      if (subscription.status !== 'cancelled' || !cancelledAt) {
        continue;
      }
      const key = monthKey(cancelledAt);
      churnByMonthMap.set(key, (churnByMonthMap.get(key) ?? 0) + 1);
    }

    const revenueByMonth = [...revenueByMonthMap.entries()]
      .map(([month, amountCents]) => ({ month, amountCents }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const churnByMonth = [...churnByMonthMap.entries()]
      .map(([month, amountCents]) => ({ month, amountCents }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const totalRevenueCents = revenueByMonth.reduce((sum, row) => sum + row.amountCents, 0);
    const mrrCents = revenueByMonth.length === 0 ? 0 : revenueByMonth[revenueByMonth.length - 1].amountCents;
    const activeSubscriptions = subscriptions.filter((row) => row.status === 'active').length;
    const cancelledSubscriptions = subscriptions.filter((row) => row.status === 'cancelled').length;

    return {
      totalRevenueCents,
      mrrCents,
      activeSubscriptions,
      cancelledSubscriptions,
      churnRate: subscriptions.length === 0 ? 0 : cancelledSubscriptions / subscriptions.length,
      revenueByMonth,
      churnByMonth,
    };
  });
}

export function __resetAnalyticsCache(): void {
  analyticsCache.clear();
}

export const __analyticsCacheTtlMs = ANALYTICS_CACHE_TTL_MS;
