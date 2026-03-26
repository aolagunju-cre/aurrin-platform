/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { DELETE as revokeRole } from '../src/app/api/admin/roles/[id]/route';
import { GET as listRoles, POST as assignRole } from '../src/app/api/admin/roles/route';
import { GET as searchUsers } from '../src/app/api/admin/users/search/route';
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
  return new NextRequest(new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }));
}

describe('admin roles routes', () => {
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

    mockDb = {
      insertFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      getExpiredFiles: jest.fn(),
      insertAuditLog: jest.fn(),
      insertOutboxJob: jest.fn(),
      fetchPendingJobs: jest.fn(),
      updateJobState: jest.fn(),
      getFounderApplicationById: jest.fn(),
      getFounderApplicationByEmail: jest.fn(),
      insertFounderApplication: jest.fn(),
      updateFounderApplication: jest.fn(),
      getUserByEmail: jest.fn(),
      insertUser: jest.fn(),
      getFounderByUserId: jest.fn(),
      insertFounder: jest.fn(),
      getRoleAssignmentsByUserId: jest.fn().mockResolvedValue({ data: [], error: null }),
      listRoleAssignments: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'ra-1',
            user_id: 'user-1',
            role: 'judge',
            scope: 'global',
            scoped_id: null,
            created_at: '2026-03-26T00:00:00.000Z',
            updated_at: '2026-03-26T00:00:00.000Z',
            created_by: 'admin-1',
            user: { id: 'user-1', email: 'judge@example.com', name: 'Judge User' },
            assigned_by_user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
          },
        ],
        error: null,
      }),
      insertRoleAssignment: jest.fn().mockResolvedValue({
        data: {
          id: 'ra-new',
          user_id: 'user-2',
          role: 'founder',
          scope: 'event',
          scoped_id: 'event-1',
          created_at: '2026-03-26T01:00:00.000Z',
          updated_at: '2026-03-26T01:00:00.000Z',
          created_by: 'admin-1',
        },
        error: null,
      }),
      deleteRoleAssignment: jest.fn().mockResolvedValue({
        data: {
          id: 'ra-1',
          user_id: 'user-1',
          role: 'judge',
          scope: 'global',
          scoped_id: null,
          created_at: '2026-03-26T00:00:00.000Z',
          updated_at: '2026-03-26T00:00:00.000Z',
          created_by: 'admin-1',
        },
        error: null,
      }),
      searchUsersByEmail: jest.fn().mockResolvedValue({
        data: [{ id: 'user-1', email: 'Judge@Example.com', name: 'Judge User' }],
        error: null,
      }),
      listRubricTemplates: jest.fn(),
      getRubricTemplateById: jest.fn(),
      insertRubricTemplate: jest.fn(),
      updateRubricTemplate: jest.fn(),
      listRubricVersionsByTemplateId: jest.fn(),
      getLatestRubricVersionByTemplateId: jest.fn(),
      insertRubricVersion: jest.fn(),
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

  it('enforces authorization for role assignment create', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    );

    const response = await assignRole(
      buildRequest('http://localhost/api/admin/roles', 'POST', {
        user_id: 'user-2',
        role: 'founder',
        scope: 'event',
        scoped_id: 'event-1',
      })
    );

    expect(response.status).toBe(403);
  });

  it('lists role assignments with user and assigned_by fields', async () => {
    const response = await listRoles(buildRequest('http://localhost/api/admin/roles', 'GET'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toEqual({
      id: 'ra-1',
      role: 'judge',
      scope: 'global',
      scoped_id: null,
      assigned_at: '2026-03-26T00:00:00.000Z',
      user: { id: 'user-1', email: 'judge@example.com', name: 'Judge User' },
      assigned_by: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
    });
  });

  it('creates role assignment and writes audit entry', async () => {
    const response = await assignRole(
      buildRequest('http://localhost/api/admin/roles', 'POST', {
        user_id: 'user-2',
        role: 'founder',
        scope: 'event',
        scoped_id: 'event-1',
      })
    );

    expect(response.status).toBe(201);
    expect(mockDb.insertRoleAssignment).toHaveBeenCalledWith({
      user_id: 'user-2',
      role: 'founder',
      scope: 'event',
      scoped_id: 'event-1',
      created_by: 'admin-1',
    });
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'role_assigned',
      'admin-1',
      expect.objectContaining({ resource_type: 'role_assignment' }),
      expect.any(Object)
    );
  });

  it('rejects duplicate assignment and leaves state unchanged', async () => {
    const existing = {
      id: 'ra-existing',
      user_id: 'user-2',
      role: 'founder',
      scope: 'event',
      scoped_id: 'event-1',
      created_at: '2026-03-26T01:00:00.000Z',
      updated_at: '2026-03-26T01:00:00.000Z',
      created_by: 'admin-1',
    };

    mockDb.getRoleAssignmentsByUserId.mockResolvedValueOnce({
      data: [existing],
      error: null,
    });

    const response = await assignRole(
      buildRequest('http://localhost/api/admin/roles', 'POST', {
        user_id: 'user-2',
        role: 'founder',
        scope: 'event',
        scoped_id: 'event-1',
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: 'DUPLICATE_ASSIGNMENT',
        message: 'Role assignment already exists for user, role, and scope.',
      },
    });
    expect(mockDb.insertRoleAssignment).not.toHaveBeenCalled();
  });

  it('rejects invalid scope/scoped_id combinations', async () => {
    const response = await assignRole(
      buildRequest('http://localhost/api/admin/roles', 'POST', {
        user_id: 'user-2',
        role: 'judge',
        scope: 'global',
        scoped_id: 'event-1',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: 'INVALID_SCOPE',
        message: 'Global scope must not include scoped_id.',
      },
    });
  });

  it('supports case-insensitive user search and returns minimal fields', async () => {
    const response = await searchUsers(buildRequest('http://localhost/api/admin/users/search?q=JUDGE', 'GET'));

    expect(response.status).toBe(200);
    expect(mockDb.searchUsersByEmail).toHaveBeenCalledWith('JUDGE', 10);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ id: 'user-1', email: 'Judge@Example.com', name: 'Judge User' }],
    });
  });

  it('revokes a role assignment and writes audit entry', async () => {
    const response = await revokeRole(
      buildRequest('http://localhost/api/admin/roles/ra-1', 'DELETE'),
      { params: Promise.resolve({ id: 'ra-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.deleteRoleAssignment).toHaveBeenCalledWith('ra-1');
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'role_revoked',
      'admin-1',
      expect.objectContaining({ resource_type: 'role_assignment' }),
      expect.any(Object)
    );
  });
});
