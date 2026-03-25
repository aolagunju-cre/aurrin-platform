/**
 * Basic in-process metrics collection.
 * Tracks counters and histograms for API latency, job processing, errors, and auth failures.
 * Exposed via /api/health for Vercel and monitoring systems.
 */

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramSnapshot>;
  timestamp: string;
}

export interface HistogramSnapshot {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

const counters: Record<string, number> = {};
const histograms: Record<string, { values: number[] }> = {};

/** Increment a counter by 1 (or by `delta`). */
export function incrementCounter(name: string, delta = 1): void {
  counters[name] = (counters[name] ?? 0) + delta;
}

/** Record a value to a histogram (e.g., latency in ms). */
export function recordHistogram(name: string, value: number): void {
  if (!histograms[name]) histograms[name] = { values: [] };
  histograms[name].values.push(value);
  // Keep last 1000 values to avoid unbounded memory growth
  if (histograms[name].values.length > 1000) {
    histograms[name].values.shift();
  }
}

function summarize(values: number[]): HistogramSnapshot {
  if (values.length === 0) return { count: 0, sum: 0, min: 0, max: 0, avg: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    sum,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
  };
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const histogramSnapshots: Record<string, HistogramSnapshot> = {};
  for (const [name, { values }] of Object.entries(histograms)) {
    histogramSnapshots[name] = summarize(values);
  }
  return {
    counters: { ...counters },
    histograms: histogramSnapshots,
    timestamp: new Date().toISOString(),
  };
}

/** Pre-defined metric names for consistent naming. */
export const Metrics = {
  API_LATENCY_MS: 'api_latency_ms',
  JOB_PROCESSING_MS: 'job_processing_ms',
  JOB_FAILURES: 'job_failures',
  AUTH_FAILURES: 'auth_failures',
  ERROR_BY_TYPE: (type: string) => `errors_${type}`,
  JOB_RETRIED: 'jobs_retried',
  JOB_PROCESSED: 'jobs_processed',
} as const;
