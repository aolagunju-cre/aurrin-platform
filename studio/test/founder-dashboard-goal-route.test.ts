/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getGoal, PATCH as patchGoal } from '../src/app/api/founder/dashboard/goal/route';
import { requireFounderOrAdmin } from '../src/lib/auth/founder';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/auth/founder', () => ({
  requireFounderOrAdmin: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedRequireFounderOrAdmin = requireFounderOrAdmin as jest.MockedFunction<typeof requireFounderOrAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

function makeRequest(body?: unknown): NextRequest {
  const init: RequestInit = { method: body ? 'PATCH' : 'GET' };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest('http://localhost/api/founder/dashboard/goal', init);
}

describe('GET /api/founder/dashboard/goal', () => {
  it('returns 401 when auth fails', async () => {
    const { NextResponse } = await import('next/server');
    mockedRequireFounderOrAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const res = await getGoal(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a founder', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      userId: 'user-1',
      auth: {} as never,
      founder: null,
      roleAssignments: [],
      isAdmin: true,
      isFounder: false,
    });

    const res = await getGoal(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns current funding_goal_cents for a founder', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      userId: 'user-1',
      auth: {} as never,
      founder: { id: 'founder-1' } as never,
      roleAssignments: [],
      isAdmin: false,
      isFounder: true,
    });

    const mockDb = {
      getUserById: jest.fn().mockResolvedValue({ data: { email: 'founder@example.com' }, error: null }),
      getFounderApplicationByEmail: jest.fn().mockResolvedValue({
        data: { id: 'app-1', funding_goal_cents: 250000 },
        error: null,
      }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await getGoal(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { funding_goal_cents: number | null } };
    expect(body.success).toBe(true);
    expect(body.data.funding_goal_cents).toBe(250000);
  });

  it('returns null when no application exists', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      userId: 'user-1',
      auth: {} as never,
      founder: { id: 'founder-1' } as never,
      roleAssignments: [],
      isAdmin: false,
      isFounder: true,
    });

    const mockDb = {
      getUserById: jest.fn().mockResolvedValue({ data: { email: 'founder@example.com' }, error: null }),
      getFounderApplicationByEmail: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await getGoal(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { funding_goal_cents: null } };
    expect(body.data.funding_goal_cents).toBeNull();
  });
});

describe('PATCH /api/founder/dashboard/goal', () => {
  it('persists funding_goal_cents in cents', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      userId: 'user-1',
      auth: {} as never,
      founder: { id: 'founder-1' } as never,
      roleAssignments: [],
      isAdmin: false,
      isFounder: true,
    });

    const updateFounderApplication = jest.fn().mockResolvedValue({
      data: { id: 'app-1', funding_goal_cents: 5000000 },
      error: null,
    });
    const mockDb = {
      getUserById: jest.fn().mockResolvedValue({ data: { email: 'founder@example.com' }, error: null }),
      getFounderApplicationByEmail: jest.fn().mockResolvedValue({
        data: { id: 'app-1', funding_goal_cents: null },
        error: null,
      }),
      updateFounderApplication,
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await patchGoal(makeRequest({ funding_goal_cents: 5000000 }));
    expect(res.status).toBe(200);
    expect(updateFounderApplication).toHaveBeenCalledWith('app-1', { funding_goal_cents: 5000000 });
    const body = await res.json() as { success: boolean; data: { funding_goal_cents: number } };
    expect(body.data.funding_goal_cents).toBe(5000000);
  });

  it('accepts null to clear the goal', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      userId: 'user-1',
      auth: {} as never,
      founder: { id: 'founder-1' } as never,
      roleAssignments: [],
      isAdmin: false,
      isFounder: true,
    });

    const updateFounderApplication = jest.fn().mockResolvedValue({
      data: { id: 'app-1', funding_goal_cents: null },
      error: null,
    });
    const mockDb = {
      getUserById: jest.fn().mockResolvedValue({ data: { email: 'founder@example.com' }, error: null }),
      getFounderApplicationByEmail: jest.fn().mockResolvedValue({
        data: { id: 'app-1', funding_goal_cents: 5000000 },
        error: null,
      }),
      updateFounderApplication,
    };
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await patchGoal(makeRequest({ funding_goal_cents: null }));
    expect(res.status).toBe(200);
    expect(updateFounderApplication).toHaveBeenCalledWith('app-1', { funding_goal_cents: null });
  });

  it('returns 400 for invalid funding_goal_cents type', async () => {
    mockedRequireFounderOrAdmin.mockResolvedValueOnce({
      userId: 'user-1',
      auth: {} as never,
      founder: { id: 'founder-1' } as never,
      roleAssignments: [],
      isAdmin: false,
      isFounder: true,
    });

    const mockDb = {};
    mockedGetSupabaseClient.mockReturnValue({ db: mockDb } as never);

    const res = await patchGoal(makeRequest({ funding_goal_cents: 'not-a-number' }));
    expect(res.status).toBe(400);
  });
});
