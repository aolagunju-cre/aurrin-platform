/**
 * Structured logging utility.
 * Outputs JSON-formatted log entries to stdout.
 * Includes request_id, job_id, timestamp, level, message, and context.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogContext {
  request_id?: string;
  job_id?: string;
  actor?: string;
  action?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  request_id?: string;
  job_id?: string;
  context?: LogContext;
}

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined;
  if (env && env in LOG_LEVEL_SEVERITY) return env;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

export function log(level: LogLevel, message: string, context?: LogContext): void {
  const minLevel = getMinLevel();
  if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[minLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context?.request_id ? { request_id: context.request_id } : {}),
    ...(context?.job_id ? { job_id: context.job_id } : {}),
    ...(context ? { context } : {}),
  };

  // Output as newline-delimited JSON to stdout
  process.stdout.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
  critical: (message: string, context?: LogContext) => log('critical', message, context),
};
