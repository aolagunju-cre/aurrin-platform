/**
 * Error tracking integration.
 * Captures errors with request context, severity levels (low/medium/high/critical),
 * and groups by error type. Compatible with Sentry — set SENTRY_DSN to enable.
 * Falls back to structured logging when Sentry is not configured.
 */

import { logger, LogContext } from '../logging/logger';
import { incrementCounter, Metrics } from '../metrics/metrics';

/** Severity levels as specified in the observability acceptance criteria. */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorTrackingContext extends LogContext {
  request_id?: string;
  actor?: string;
  [key: string]: unknown;
}

export interface CapturedError {
  message: string;
  stack?: string;
  type: string;
  severity: ErrorSeverity;
  context?: ErrorTrackingContext;
  timestamp: string;
}

// In-process store (useful for tests and self-hosted monitoring)
const capturedErrors: CapturedError[] = [];

function deriveType(error: Error | string): string {
  if (error instanceof Error) return error.constructor.name || 'Error';
  return 'StringError';
}

function severityToLogLevel(severity: ErrorSeverity): 'warn' | 'error' | 'critical' {
  switch (severity) {
    case 'low': return 'warn';
    case 'medium': return 'error';
    case 'high': return 'error';
    case 'critical': return 'critical';
  }
}

/**
 * Capture an error with severity and optional request context.
 * Automatically groups by error type and increments the error counter.
 */
export function captureError(
  error: Error | string,
  severity: ErrorSeverity = 'medium',
  context?: ErrorTrackingContext,
): void {
  const type = deriveType(error);
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  const captured: CapturedError = {
    message,
    stack,
    type,
    severity,
    context,
    timestamp: new Date().toISOString(),
  };
  capturedErrors.push(captured);

  // Emit structured log at the appropriate level
  logger[severityToLogLevel(severity)](
    `[ErrorTracking] ${message}`,
    { ...context, error_type: type, severity },
  );

  // Increment error counter grouped by type
  incrementCounter(Metrics.ERROR_BY_TYPE(type));

  // If Sentry DSN is configured, forward via dynamic import to keep Sentry optional.
  // In production, install @sentry/nextjs and set SENTRY_DSN.
  if (process.env.SENTRY_DSN) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nextjs') as {
        captureException: (e: unknown, opts: unknown) => void;
        captureMessage: (m: string, opts: unknown) => void;
      };
      const sentryLevel = severity === 'low' ? 'warning' : severity === 'medium' ? 'error' : severity;
      if (error instanceof Error) {
        Sentry.captureException(error, { level: sentryLevel, extra: context });
      } else {
        Sentry.captureMessage(message, { level: sentryLevel, extra: context });
      }
    } catch {
      // Sentry not installed — log a one-time warning
      logger.warn('@sentry/nextjs not installed. Set SENTRY_DSN only after installing the package.');
    }
  }
}

/** Return a copy of all captured errors (useful in tests and monitoring). */
export function getCapturedErrors(): CapturedError[] {
  return [...capturedErrors];
}

/** Clear the in-process capture store (use in test teardown). */
export function clearCapturedErrors(): void {
  capturedErrors.length = 0;
}
