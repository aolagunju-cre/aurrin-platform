/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as listRubrics, POST as createRubric } from '../src/app/api/admin/rubrics/route';
import { PATCH as updateRubric } from '../src/app/api/admin/rubrics/[id]/route';
import { POST as cloneRubric } from '../src/app/api/admin/rubrics/[id]/clone/route';
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

describe('admin rubrics API routes', () => {
  const baseTemplate = {
    id: 'template-1',
    name: 'Startup Rubric',
    description: 'Initial rubric',
    created_at: '2026-03-25T00:00:00.000Z',
    updated_at: '2026-03-25T00:00:00.000Z',
  };

  const versionOne = {
    id: 'version-1',
    rubric_template_id: 'template-1',
    event_id: null,
    version: 1,
    created_at: '2026-03-25T00:00:00.000Z',
    definition: {
      categories: [
        {
          name: 'Problem',
          weight: 100,
          questions: [
            { text: 'How severe is the problem?', response_type: 'score', scale: [1, 2, 3, 4, 5] },
          ],
        },
      ],
    },
  };

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
      getRoleAssignmentsByUserId: jest.fn(),
      listRubricTemplates: jest.fn().mockResolvedValue({ data: [baseTemplate], error: null }),
      getRubricTemplateById: jest.fn().mockResolvedValue({ data: baseTemplate, error: null }),
      insertRubricTemplate: jest.fn().mockResolvedValue({ data: { ...baseTemplate, id: 'template-2' }, error: null }),
      updateRubricTemplate: jest.fn().mockResolvedValue({ data: baseTemplate, error: null }),
      listRubricVersionsByTemplateId: jest.fn().mockResolvedValue({ data: [versionOne], error: null }),
      getLatestRubricVersionByTemplateId: jest.fn().mockResolvedValue({ data: versionOne, error: null }),
      insertRubricVersion: jest.fn().mockResolvedValue({
        data: { ...versionOne, id: 'version-2', version: 2 },
        error: null,
      }),
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

  it('enforces auth guard on list endpoint', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await listRubrics(buildRequest('http://localhost/api/admin/rubrics', 'GET'));
    expect(response.status).toBe(401);
  });

  it('lists rubric summaries with latest version metadata', async () => {
    const response = await listRubrics(buildRequest('http://localhost/api/admin/rubrics', 'GET'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      {
        id: 'template-1',
        name: 'Startup Rubric',
        description: 'Initial rubric',
        version: 1,
        question_count: 1,
        last_updated: '2026-03-25T00:00:00.000Z',
      },
    ]);
  });

  it('fails list endpoint when latest version retrieval fails', async () => {
    mockDb.getLatestRubricVersionByTemplateId.mockResolvedValueOnce({
      data: null,
      error: { message: 'lookup failed' },
    });

    const response = await listRubrics(buildRequest('http://localhost/api/admin/rubrics', 'GET'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'lookup failed',
    });
  });

  it('creates a rubric template and initial version', async () => {
    mockDb.insertRubricVersion.mockResolvedValueOnce({ data: { ...versionOne, rubric_template_id: 'template-2' }, error: null });

    const response = await createRubric(
      buildRequest('http://localhost/api/admin/rubrics', 'POST', {
        name: 'Growth Rubric',
        description: 'Scores traction and expansion',
        definition: versionOne.definition,
      })
    );

    expect(response.status).toBe(201);
    expect(mockDb.insertRubricTemplate).toHaveBeenCalledWith({
      name: 'Growth Rubric',
      description: 'Scores traction and expansion',
    });
    expect(mockDb.insertRubricVersion).toHaveBeenCalledWith({
      rubric_template_id: 'template-2',
      version: 1,
      definition: versionOne.definition,
    });
    expect(mockedAuditLog).toHaveBeenCalled();
  });

  it('blocks save when category weights do not sum to 100', async () => {
    const response = await updateRubric(
      buildRequest('http://localhost/api/admin/rubrics/template-1', 'PATCH', {
        definition: {
          categories: [
            {
              name: 'Problem',
              weight: 90,
              questions: [{ text: 'Q1', response_type: 'score', scale: [1, 2, 3, 4, 5] }],
            },
          ],
        },
      }),
      { params: Promise.resolve({ id: 'template-1' }) }
    );

    expect(response.status).toBe(400);
    expect(mockDb.insertRubricVersion).not.toHaveBeenCalled();
  });

  it('creates a new immutable version on update and preserves prior definition', async () => {
    const previousDefinition = JSON.parse(JSON.stringify(versionOne.definition));
    const editedDefinition = {
      categories: [
        {
          name: 'Problem',
          weight: 100,
          questions: [
            { text: 'How urgent is the problem now?', response_type: 'score', scale: [1, 2, 3, 4, 5] },
          ],
        },
      ],
    };

    mockDb.getLatestRubricVersionByTemplateId.mockResolvedValueOnce({
      data: { ...versionOne, definition: previousDefinition },
      error: null,
    });

    mockDb.insertRubricVersion.mockImplementationOnce(async ({ rubric_template_id, version, definition }) => ({
      data: {
        ...versionOne,
        id: 'version-2',
        rubric_template_id,
        version,
        definition,
      },
      error: null,
    }));

    const response = await updateRubric(
      buildRequest('http://localhost/api/admin/rubrics/template-1', 'PATCH', {
        name: 'Startup Rubric v2',
        description: 'Updated',
        definition: editedDefinition,
      }),
      { params: Promise.resolve({ id: 'template-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.insertRubricVersion).toHaveBeenCalledWith({
      rubric_template_id: 'template-1',
      version: 2,
      definition: editedDefinition,
    });
    expect(mockDb.updateRubricTemplate).toHaveBeenCalled();
    expect(mockedAuditLog).toHaveBeenCalled();
    expect(previousDefinition).toEqual(versionOne.definition);
    expect(previousDefinition).not.toEqual(editedDefinition);
  });

  it('clones a rubric into a distinct template and version set', async () => {
    mockDb.insertRubricTemplate.mockResolvedValueOnce({
      data: { ...baseTemplate, id: 'template-clone', name: 'Startup Rubric (Clone)' },
      error: null,
    });
    mockDb.insertRubricVersion.mockResolvedValueOnce({
      data: { ...versionOne, id: 'version-clone', rubric_template_id: 'template-clone', version: 1 },
      error: null,
    });

    const response = await cloneRubric(
      buildRequest('http://localhost/api/admin/rubrics/template-1/clone', 'POST', {}),
      { params: Promise.resolve({ id: 'template-1' }) }
    );

    expect(response.status).toBe(201);
    expect(mockDb.insertRubricTemplate).toHaveBeenCalledWith({
      name: 'Startup Rubric (Clone)',
      description: 'Initial rubric',
    });
    expect(mockDb.insertRubricVersion).toHaveBeenCalledWith({
      rubric_template_id: 'template-clone',
      version: 1,
      definition: versionOne.definition,
    });
    expect(mockedAuditLog).toHaveBeenCalled();
  });
});
