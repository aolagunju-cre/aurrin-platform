/** @jest-environment node */

import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { getRoleAssignmentsForUser, resolveAuthIdentityFromRequest } from '../src/lib/auth/request-auth';

jest.mock('../src/lib/auth/request-auth', () => {
  const actual = jest.requireActual('../src/lib/auth/request-auth');
  return {
    ...actual,
    resolveAuthIdentityFromRequest: jest.fn(),
    getRoleAssignmentsForUser: jest.fn(),
  };
});

const mockedResolveAuthIdentityFromRequest = resolveAuthIdentityFromRequest as jest.MockedFunction<typeof resolveAuthIdentityFromRequest>;
const mockedGetRoleAssignmentsForUser = getRoleAssignmentsForUser as jest.MockedFunction<typeof getRoleAssignmentsForUser>;

describe('middleware role enforcement parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetRoleAssignmentsForUser.mockResolvedValue([]);
  });

  it('returns 401 for unauthenticated protected API requests', async () => {
    mockedResolveAuthIdentityFromRequest.mockResolvedValue(null);

    const response = await middleware(new NextRequest(new Request('http://localhost/api/admin/roles', { method: 'GET' })));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 for access-token users without required role on protected API routes', async () => {
    mockedResolveAuthIdentityFromRequest.mockResolvedValue({
      kind: 'access-token',
      userId: 'user-123',
      email: 'user@example.com',
      jwt: null,
      accessToken: 'token',
      demoSession: null,
    });
    mockedGetRoleAssignmentsForUser.mockResolvedValueOnce([
      {
        id: 'ra-1',
        user_id: 'user-123',
        role: 'founder',
        scope: 'global',
        scoped_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-123',
      },
    ]);

    const response = await middleware(new NextRequest(new Request('http://localhost/api/admin/roles', { method: 'GET' })));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('allows access-token users when role_assignments include required role', async () => {
    mockedResolveAuthIdentityFromRequest.mockResolvedValue({
      kind: 'access-token',
      userId: 'user-123',
      email: 'admin@example.com',
      jwt: null,
      accessToken: 'token',
      demoSession: null,
    });
    mockedGetRoleAssignmentsForUser.mockResolvedValueOnce([
      {
        id: 'ra-2',
        user_id: 'user-123',
        role: 'admin',
        scope: 'global',
        scoped_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-123',
      },
    ]);

    const response = await middleware(new NextRequest(new Request('http://localhost/admin/donations', { method: 'GET' })));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('does not gate /founders/[slug] public founder profile pages', async () => {
    // Regression guard: the protected prefix `/founder` used to match `/founders/...`
    // via startsWith, redirecting the public founder profile route to sign-in.
    mockedResolveAuthIdentityFromRequest.mockResolvedValue(null);

    const response = await middleware(
      new NextRequest(new Request('http://localhost/founders/maya-chen-terravolt', { method: 'GET' }))
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('still gates /founder/dashboard for unauthenticated users', async () => {
    // Companion to the above — verifies the fix does not accidentally open the
    // authenticated founder dashboard.
    mockedResolveAuthIdentityFromRequest.mockResolvedValue(null);

    const response = await middleware(
      new NextRequest(new Request('http://localhost/founder/dashboard', { method: 'GET' }))
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/sign-in');
  });
});
