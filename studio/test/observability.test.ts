/**
 * Tests for Observability: structured logging, audit logging, metrics, and health endpoint.
 */

import { log, logger, LogLevel } from '../src/lib/logging/logger';
import { incrementCounter, recordHistogram, getMetricsSnapshot, Metrics } from '../src/lib/metrics/metrics';
import { setSupabaseClient, resetSupabaseClient, SupabaseClient, AuditLogInsert } from '../src/lib/db/client';
import { auditLog } from '../src/lib/audit/log';
import { captureError, getCapturedErrors, clearCapturedErrors, ErrorSeverity } from '../src/lib/tracking/errorTracking';

// ─── Logger Tests ─────────────────────────────────────────────────────────────

describe('Structured Logger', () => {
  let writeSpy: jest.SpyInstance;
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((data: string | Uint8Array) => {
      capturedOutput.push(typeof data === 'string' ? data : Buffer.from(data).toString());
      return true;
    });
    // Allow all log levels in tests
    process.env.LOG_LEVEL = 'debug';
  });

  afterEach(() => {
    writeSpy.mockRestore();
    delete process.env.LOG_LEVEL;
  });

  function getLastEntry(): Record<string, unknown> {
    const last = capturedOutput[capturedOutput.length - 1];
    return JSON.parse(last.trim());
  }

  it('logs a message with JSON format', () => {
    log('info', 'test message');
    const entry = getLastEntry();
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('test message');
    expect(entry.timestamp).toBeDefined();
  });

  it('includes context fields in output', () => {
    log('warn', 'context test', { request_id: 'req-123', actor: 'user-abc' });
    const entry = getLastEntry();
    expect(entry.request_id).toBe('req-123');
    expect(entry.context).toMatchObject({ request_id: 'req-123', actor: 'user-abc' });
  });

  it('includes job_id when provided', () => {
    log('info', 'job event', { job_id: 'job-456' });
    const entry = getLastEntry();
    expect(entry.job_id).toBe('job-456');
  });

  it('supports all log levels', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
    for (const level of levels) {
      log(level, `${level} message`);
    }
    expect(capturedOutput.length).toBe(5);
    const entries = capturedOutput.map((s) => JSON.parse(s.trim()));
    expect(entries.map((e) => e.level)).toEqual(levels);
  });

  it('logger convenience methods produce correct levels', () => {
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    logger.critical('c');
    const entries = capturedOutput.map((s) => JSON.parse(s.trim()));
    expect(entries[0].level).toBe('debug');
    expect(entries[1].level).toBe('info');
    expect(entries[2].level).toBe('warn');
    expect(entries[3].level).toBe('error');
    expect(entries[4].level).toBe('critical');
  });

  it('filters messages below minimum log level', () => {
    process.env.LOG_LEVEL = 'warn';
    log('debug', 'should be filtered');
    log('info', 'also filtered');
    log('warn', 'visible');
    expect(capturedOutput.length).toBe(1);
    const entry = getLastEntry();
    expect(entry.level).toBe('warn');
  });
});

// ─── Metrics Tests ────────────────────────────────────────────────────────────

describe('Metrics', () => {
  it('increments counters', () => {
    const before = getMetricsSnapshot().counters;
    const startVal = before['test_counter'] ?? 0;
    incrementCounter('test_counter');
    incrementCounter('test_counter');
    const snapshot = getMetricsSnapshot();
    expect(snapshot.counters['test_counter']).toBe(startVal + 2);
  });

  it('records histogram values', () => {
    const uniqueName = `hist_${Date.now()}`;
    recordHistogram(uniqueName, 100);
    recordHistogram(uniqueName, 200);
    recordHistogram(uniqueName, 300);
    const snapshot = getMetricsSnapshot();
    const h = snapshot.histograms[uniqueName];
    expect(h).toBeDefined();
    expect(h.count).toBe(3);
    expect(h.sum).toBe(600);
    expect(h.min).toBe(100);
    expect(h.max).toBe(300);
    expect(h.avg).toBe(200);
  });

  it('has pre-defined metric names', () => {
    expect(Metrics.API_LATENCY_MS).toBe('api_latency_ms');
    expect(Metrics.JOB_PROCESSING_MS).toBe('job_processing_ms');
    expect(Metrics.JOB_FAILURES).toBe('job_failures');
    expect(Metrics.AUTH_FAILURES).toBe('auth_failures');
    expect(Metrics.ERROR_BY_TYPE('http_500')).toBe('errors_http_500');
    expect(Metrics.JOB_PROCESSED).toBe('jobs_processed');
  });

  it('includes timestamp in snapshot', () => {
    const snapshot = getMetricsSnapshot();
    expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── Audit Log Tests ──────────────────────────────────────────────────────────

describe('Audit Log', () => {
  let insertedLogs: AuditLogInsert[];

  beforeEach(() => {
    insertedLogs = [];
    const mockClient: SupabaseClient = {
      storage: {
        upload: jest.fn(),
        getSignedUrl: jest.fn(),
        deleteFile: jest.fn(),
      },
      db: {
        insertFile: jest.fn(),
        getFile: jest.fn(),
        deleteFile: jest.fn(),
        listExpiredFiles: jest.fn(),
        insertAuditLog: jest.fn(async (entry: AuditLogInsert) => {
          insertedLogs.push(entry);
          return { error: null };
        }),
      },
    };
    setSupabaseClient(mockClient);
  });

  afterEach(() => {
    resetSupabaseClient();
  });

  it('creates an audit log entry with required fields', async () => {
    await auditLog(
      'role_assigned',
      'actor-user-id',
      { resource_type: 'user_roles', resource_id: 'target-user-id', changes: { before: null, after: { role: 'Judge' } } }
    );
    expect(insertedLogs.length).toBe(1);
    const entry = insertedLogs[0];
    expect(entry.actor_id).toBe('actor-user-id');
    expect(entry.action).toBe('role_assigned');
    expect(entry.resource_type).toBe('user_roles');
    expect(entry.resource_id).toBe('target-user-id');
    expect(entry.changes).toMatchObject({ before: null, after: { role: 'Judge' } });
  });

  it('handles optional context', async () => {
    await auditLog(
      'export_created',
      'admin-id',
      { resource_type: 'exports' },
      { request_id: 'req-xyz' }
    );
    expect(insertedLogs.length).toBe(1);
    expect(insertedLogs[0].action).toBe('export_created');
  });

  it('does not throw when db insertion fails', async () => {
    const mockClient: SupabaseClient = {
      storage: { upload: jest.fn(), getSignedUrl: jest.fn(), deleteFile: jest.fn() },
      db: {
        insertFile: jest.fn(),
        getFile: jest.fn(),
        deleteFile: jest.fn(),
        listExpiredFiles: jest.fn(),
        insertAuditLog: jest.fn(async () => ({ error: new Error('DB error') })),
      },
    };
    setSupabaseClient(mockClient);

    // Should NOT throw even though DB fails
    await expect(
      auditLog('score_locked', 'admin', { resource_type: 'scores' })
    ).resolves.not.toThrow();
  });

  it('supports all standard audit action types', async () => {
    const actions = [
      'role_assigned', 'role_revoked', 'event_status_changed',
      'score_locked', 'score_published', 'founder_approved',
      'entitlement_granted', 'export_created',
    ] as const;

    for (const action of actions) {
      await auditLog(action, 'actor', { resource_type: 'test' });
    }
    expect(insertedLogs.length).toBe(actions.length);
    expect(insertedLogs.map((l) => l.action)).toEqual(actions);
  });
});

// ─── Error Tracking Tests ─────────────────────────────────────────────────────

describe('Error Tracking', () => {
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    clearCapturedErrors();
    // Suppress log output during error tracking tests
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    clearCapturedErrors();
  });

  it('captures an Error object and stores it', () => {
    const err = new Error('Something went wrong');
    captureError(err, 'high', { request_id: 'req-abc' });

    const captured = getCapturedErrors();
    expect(captured.length).toBe(1);
    expect(captured[0].message).toBe('Something went wrong');
    expect(captured[0].type).toBe('Error');
    expect(captured[0].severity).toBe('high');
    expect(captured[0].context?.request_id).toBe('req-abc');
    expect(captured[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('captures a string error', () => {
    captureError('Database timeout', 'medium');

    const captured = getCapturedErrors();
    expect(captured.length).toBe(1);
    expect(captured[0].message).toBe('Database timeout');
    expect(captured[0].type).toBe('StringError');
    expect(captured[0].severity).toBe('medium');
  });

  it('supports all four severity levels', () => {
    const levels: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];
    for (const severity of levels) {
      captureError(`${severity} error`, severity);
    }
    const captured = getCapturedErrors();
    expect(captured.map((c) => c.severity)).toEqual(levels);
  });

  it('groups errors by type via metrics counter', () => {
    const before = getMetricsSnapshot().counters[Metrics.ERROR_BY_TYPE('TypeError')] ?? 0;

    captureError(new TypeError('type problem'), 'low');
    captureError(new TypeError('another type problem'), 'medium');

    const after = getMetricsSnapshot().counters[Metrics.ERROR_BY_TYPE('TypeError')];
    expect(after).toBe(before + 2);
  });

  it('captures error with actor context', () => {
    captureError(new Error('Permission denied'), 'high', {
      request_id: 'req-xyz',
      actor: 'admin-user-id',
    });
    const captured = getCapturedErrors();
    expect(captured[0].context?.actor).toBe('admin-user-id');
    expect(captured[0].context?.request_id).toBe('req-xyz');
  });

  it('getCapturedErrors returns a copy, not the internal array', () => {
    captureError('original error', 'low');
    const first = getCapturedErrors();
    captureError('second error', 'low');
    expect(first.length).toBe(1);
    expect(getCapturedErrors().length).toBe(2);
  });

  it('clearCapturedErrors empties the store', () => {
    captureError('error one', 'low');
    captureError('error two', 'medium');
    expect(getCapturedErrors().length).toBe(2);
    clearCapturedErrors();
    expect(getCapturedErrors().length).toBe(0);
  });
});
