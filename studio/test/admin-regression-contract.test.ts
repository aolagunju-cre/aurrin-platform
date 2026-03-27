/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { POST as createEvent } from '../src/app/api/admin/events/route';
import { PATCH as updateEvent } from '../src/app/api/admin/events/[eventId]/route';
import { POST as assignJudges } from '../src/app/api/admin/events/[eventId]/assign-judges/route';
import { requireAdmin } from '../src/lib/auth/admin';
import { getSupabaseClient } from '../src/lib/db/client';
import { auditLog } from '../src/lib/audit/log';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedAuditLog = auditLog as jest.MockedFunction<typeof auditLog>;

function buildRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

describe('admin regression contract', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedAuditLog.mockReset();
    mockedRequireAdmin.mockReset();
    mockedRequireAdmin.mockResolvedValue({
      userId: 'admin-1',
      auth: {
        sub: 'admin-1',
        email: 'admin@example.com',
        iat: 0,
        exp: 9999999999,
        aud: 'authenticated',
        iss: 'https://example.supabase.co/auth/v1',
      },
    });

    const existingEvent = {
      id: 'event-1',
      name: 'Demo Day',
      description: 'Pitch event',
      status: 'upcoming',
      starts_at: '2026-05-01T10:00:00.000Z',
      ends_at: '2026-05-01T12:00:00.000Z',
      config: { max_judges: 4, max_founders: 8, rubric_id: 'rubric-1' },
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    };

    mockDb = {
      insertEvent: jest.fn().mockResolvedValue({ data: { ...existingEvent, id: 'event-2' }, error: null }),
      getEventById: jest.fn().mockResolvedValue({ data: existingEvent, error: null }),
      updateEvent: jest.fn().mockResolvedValue({ data: { ...existingEvent, name: 'Updated Demo Day' }, error: null }),
      listRoleAssignments: jest.fn().mockResolvedValue({ data: [], error: null }),
      insertRoleAssignment: jest.fn().mockResolvedValue({ data: { id: 'ra-1' }, error: null }),
      deleteRoleAssignment: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });
  });

  it('returns unauthorized status when admin auth check fails', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await createEvent(
      buildRequest('http://localhost/api/admin/events', 'POST', {
        name: 'Event A',
        start_date: '2026-06-01T10:00:00.000Z',
        end_date: '2026-06-01T12:00:00.000Z',
      })
    );

    expect(response.status).toBe(401);
  });

  it('persists event creation through the database contract', async () => {
    const response = await createEvent(
      buildRequest('http://localhost/api/admin/events', 'POST', {
        name: 'Event B',
        start_date: '2026-06-01T10:00:00.000Z',
        end_date: '2026-06-01T12:00:00.000Z',
        max_judges: 6,
        max_founders: 12,
      })
    );

    expect(response.status).toBe(201);
    expect(mockDb.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Event B',
        starts_at: '2026-06-01T10:00:00.000Z',
        ends_at: '2026-06-01T12:00:00.000Z',
      })
    );
  });

  it('writes an audit entry when event details are updated', async () => {
    const response = await updateEvent(
      buildRequest('http://localhost/api/admin/events/event-1', 'PATCH', {
        name: 'Updated Demo Day',
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.updateEvent).toHaveBeenCalledWith('event-1', expect.objectContaining({ name: 'Updated Demo Day' }));
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'event_updated',
      'admin-1',
      expect.objectContaining({ resource_type: 'event', resource_id: 'event-1' }),
      expect.any(Object)
    );
  });

  it('persists judge assignment updates through role assignments', async () => {
    const response = await assignJudges(
      buildRequest('http://localhost/api/admin/events/event-1/assign-judges', 'POST', {
        judge_user_ids: ['judge-1'],
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.insertRoleAssignment).toHaveBeenCalledWith({
      user_id: 'judge-1',
      role: 'judge',
      scope: 'event',
      scoped_id: 'event-1',
      created_by: 'admin-1',
    });
  });
});
