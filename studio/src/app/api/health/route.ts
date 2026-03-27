/**
 * GET /api/health
 *
 * Health check endpoint used by Vercel and monitoring systems.
 * Returns { status, timestamp, version, checks: { db, storage } }.
 */

import { NextResponse } from 'next/server';
import { getRuntimeEnv } from '../../../lib/config/env';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  latency_ms?: number;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  checks: {
    db: HealthCheck;
    storage: HealthCheck;
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const runtimeEnv = getRuntimeEnv();
  const supabaseUrl = runtimeEnv.supabaseUrl;
  const supabaseKey = runtimeEnv.supabaseServiceRoleKey ?? runtimeEnv.supabaseAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    return { status: 'error' };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    const latency_ms = Date.now() - start;
    return { status: response.ok ? 'ok' : 'degraded', latency_ms };
  } catch {
    return { status: 'error', latency_ms: Date.now() - start };
  }
}

async function checkStorage(): Promise<HealthCheck> {
  const runtimeEnv = getRuntimeEnv();
  const supabaseUrl = runtimeEnv.supabaseUrl;
  const supabaseKey = runtimeEnv.supabaseServiceRoleKey ?? runtimeEnv.supabaseAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    return { status: 'error' };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    const latency_ms = Date.now() - start;
    return { status: response.ok ? 'ok' : 'degraded', latency_ms };
  } catch {
    return { status: 'error', latency_ms: Date.now() - start };
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const [db, storage] = await Promise.all([checkDatabase(), checkStorage()]);

  const allOk = db.status === 'ok' && storage.status === 'ok';
  const anyError = db.status === 'error' || storage.status === 'error';
  const overallStatus = allOk ? 'ok' : anyError ? 'error' : 'degraded';

  const body: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
    checks: { db, storage },
  };

  // Return 200 for ok/degraded, 503 for full error
  const statusCode = overallStatus === 'error' ? 503 : 200;
  return NextResponse.json(body, { status: statusCode });
}
