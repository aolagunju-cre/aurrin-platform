/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getDirectoryPublishing, POST as postDirectoryPublishing } from '../src/app/api/admin/events/[eventId]/directory-publishing/route';
import { requireAdmin } from '../src/lib/auth/admin';
import { getSupabaseClient } from '../src/lib/db/client';
import { sendEmail } from '../src/lib/email/send';
import { auditLog } from '../src/lib/audit/log';

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/email/send', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn(),
}));

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
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

describe('admin directory publishing route', () => {
  let mockDb: Record<string, jest.Mock>;

  beforeEach(() => {
    mockedRequireAdmin.mockReset();
    mockedGetSupabaseClient.mockReset();
    mockedSendEmail.mockReset();
    mockedAuditLog.mockReset();

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
      getEventById: jest.fn().mockResolvedValue({
        data: {
          id: 'event-1',
          name: 'Spring Demo Day',
          description: null,
          status: 'archived',
          start_date: '2026-04-01T10:00:00.000Z',
          end_date: '2026-04-01T12:00:00.000Z',
          scoring_start: '2026-04-01T10:10:00.000Z',
          scoring_end: '2026-04-01T11:10:00.000Z',
          publishing_start: '2026-03-01T11:30:00.000Z',
          publishing_end: '2026-03-02T11:30:00.000Z',
          archived_at: '2026-04-01T12:00:00.000Z',
          starts_at: '2026-04-01T10:00:00.000Z',
          ends_at: '2026-04-01T12:00:00.000Z',
          config: {},
          created_at: '2026-03-10T00:00:00.000Z',
          updated_at: '2026-03-10T00:00:00.000Z',
        },
        error: null,
      }),
      listFounderPitchesByEventId: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'pitch-1',
            founder_id: 'founder-1',
            event_id: 'event-1',
            pitch_order: 1,
            pitch_deck_url: null,
            score_aggregate: 93,
            score_breakdown: null,
            validation_summary: null,
            is_published: true,
            published_at: '2026-04-01T11:40:00.000Z',
            visible_in_directory: false,
            public_profile_slug: 'orbit-labs',
            created_at: '2026-04-01T09:00:00.000Z',
            updated_at: '2026-04-01T09:00:00.000Z',
            founder: {
              id: 'founder-1',
              company_name: 'Orbit Labs',
              user: {
                id: 'user-1',
                email: 'founder1@example.com',
                name: 'Founder One',
              },
            },
          },
          {
            id: 'pitch-2',
            founder_id: 'founder-2',
            event_id: 'event-1',
            pitch_order: 2,
            pitch_deck_url: null,
            score_aggregate: 85,
            score_breakdown: null,
            validation_summary: null,
            is_published: true,
            published_at: '2026-04-01T11:40:00.000Z',
            visible_in_directory: true,
            public_profile_slug: 'alpha-systems',
            created_at: '2026-04-01T09:00:00.000Z',
            updated_at: '2026-04-01T09:00:00.000Z',
            founder: {
              id: 'founder-2',
              company_name: 'Alpha Systems',
              user: {
                id: 'user-2',
                email: 'founder2@example.com',
                name: 'Founder Two',
              },
            },
          },
        ],
        error: null,
      }),
      queryTable: jest.fn().mockResolvedValue({
        data: [
          { email: 'founder1@example.com', status: 'accepted', updated_at: '2026-04-01T11:00:00.000Z' },
          { email: 'founder2@example.com', status: 'assigned', updated_at: '2026-04-01T11:00:00.000Z' },
        ],
        error: null,
      }),
      updateFounderPitch: jest.fn().mockResolvedValue({
        data: {
          id: 'pitch-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          pitch_order: 1,
          pitch_deck_url: null,
          score_aggregate: 93,
          score_breakdown: null,
          validation_summary: null,
          is_published: true,
          published_at: '2026-04-01T11:40:00.000Z',
          visible_in_directory: true,
          public_profile_slug: 'orbit-labs',
          created_at: '2026-04-01T09:00:00.000Z',
          updated_at: '2026-04-01T11:50:00.000Z',
        },
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

    mockedSendEmail.mockResolvedValue({
      id: 'job-1',
      job_type: 'send_email',
      aggregate_id: null,
      aggregate_type: null,
      payload: {},
      state: 'pending',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      email_id: null,
      error_message: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-04-01T11:45:00.000Z',
      updated_at: '2026-04-01T11:45:00.000Z',
    });
  });

  it('returns candidates and auto-publish eligibility for wrap-up control', async () => {
    const response = await getDirectoryPublishing(
      buildRequest('http://localhost/api/admin/events/event-1/directory-publishing', 'GET'),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.publishing_allowed).toBe(true);
    expect(payload.data.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          founder_id: 'founder-1',
          eligible_for_auto_publish: true,
        }),
      ])
    );
  });

  it('rejects publishing before lifecycle prerequisites are satisfied', async () => {
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'Spring Demo Day',
        description: null,
        status: 'live',
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        scoring_start: '2026-04-01T10:10:00.000Z',
        scoring_end: '2026-04-01T11:10:00.000Z',
        publishing_start: '2099-04-01T11:30:00.000Z',
        publishing_end: '2099-04-02T11:30:00.000Z',
        archived_at: null,
        starts_at: '2026-04-01T10:00:00.000Z',
        ends_at: '2026-04-01T12:00:00.000Z',
        config: {},
        created_at: '2026-03-10T00:00:00.000Z',
        updated_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });

    const response = await postDirectoryPublishing(
      buildRequest('http://localhost/api/admin/events/event-1/directory-publishing', 'POST', {
        founder_ids: ['founder-1'],
        visible: true,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(409);
    expect(mockDb.updateFounderPitch).not.toHaveBeenCalled();
  });

  it('publishes selected founders with idempotent email behavior', async () => {
    const response = await postDirectoryPublishing(
      buildRequest('http://localhost/api/admin/events/event-1/directory-publishing', 'POST', {
        founder_ids: ['founder-1', 'founder-2'],
        visible: true,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.updateFounderPitch).toHaveBeenCalledTimes(1);
    expect(mockDb.updateFounderPitch).toHaveBeenCalledWith(
      'pitch-1',
      expect.objectContaining({ visible_in_directory: true })
    );
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendEmail).toHaveBeenCalledWith(
      'founder1@example.com',
      'directory_published',
      expect.objectContaining({
        link: expect.stringContaining('/public/directory/orbit-labs'),
      })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'directory_visibility_batch_updated',
      'admin-1',
      expect.objectContaining({ resource_type: 'event', resource_id: 'event-1' }),
      expect.any(Object)
    );
  });

  it('auto-publishes all accepted founders', async () => {
    const response = await postDirectoryPublishing(
      buildRequest('http://localhost/api/admin/events/event-1/directory-publishing', 'POST', {
        auto_publish_accepted: true,
        visible: true,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.requested_founder_ids).toEqual(expect.arrayContaining(['founder-1', 'founder-2']));
  });

  it('returns admin guard response for non-admin callers', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    );

    const response = await postDirectoryPublishing(
      buildRequest('http://localhost/api/admin/events/event-1/directory-publishing', 'POST', {
        founder_ids: ['founder-1'],
        visible: true,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(403);
  });
});
