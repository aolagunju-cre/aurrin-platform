/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as listEvents, POST as createEvent } from '../src/app/api/admin/events/route';
import { DELETE as archiveEvent, GET as getEvent, PATCH as updateEvent } from '../src/app/api/admin/events/[id]/route';
import { GET as getJudgeAssignments, POST as assignJudges } from '../src/app/api/admin/events/[id]/assign-judges/route';
import { GET as getFounderAssignments, POST as assignFounders } from '../src/app/api/admin/events/[id]/assign-founders/route';
import { PATCH as patchEventStatus } from '../src/app/api/admin/events/[id]/status/route';
import { PATCH as patchScoringWindow } from '../src/app/api/admin/events/[id]/scoring-window/route';
import { PATCH as patchPublishingWindow } from '../src/app/api/admin/events/[id]/publishing-window/route';
import { GET as listEventSponsors, POST as addEventSponsor } from '../src/app/api/admin/events/[id]/sponsors/route';
import { POST as createMentorMatch } from '../src/app/api/admin/events/[eventId]/mentors/matches/route';
import { DELETE as deleteMentorMatch } from '../src/app/api/admin/events/[eventId]/mentors/matches/[matchId]/route';
import { POST as generateMentorMatches } from '../src/app/api/admin/events/[eventId]/mentors/match/route';
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

describe('admin events routes', () => {
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

    const event = {
      id: 'event-1',
      name: 'April Demo Day',
      description: 'Pitch event',
      status: 'upcoming',
      start_date: '2026-04-01T10:00:00.000Z',
      end_date: '2026-04-01T12:00:00.000Z',
      scoring_start: '2026-04-01T10:15:00.000Z',
      scoring_end: '2026-04-01T11:45:00.000Z',
      publishing_start: '2026-04-01T12:30:00.000Z',
      publishing_end: '2026-04-02T12:30:00.000Z',
      archived_at: null,
      starts_at: '2026-04-01T10:00:00.000Z',
      ends_at: '2026-04-01T12:00:00.000Z',
      config: { max_judges: 4, max_founders: 8, rubric_id: 'rubric-1' },
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T00:00:00.000Z',
    };

    mockDb = {
      queryTable: jest.fn().mockResolvedValue({ data: [{ id: 'fa-1', assigned_event_id: 'event-1', status: 'assigned' }], error: null }),
      insertFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      getExpiredFiles: jest.fn(),
      insertAuditLog: jest.fn(),
      insertOutboxJob: jest.fn().mockResolvedValue({
        data: {
          id: 'job-1',
          job_type: 'mentor_match',
          aggregate_id: 'match-1',
          aggregate_type: 'mentor_match',
          payload: { match_id: 'match-1', reason: 'match_created' },
          state: 'pending',
          retry_count: 0,
          max_retries: 3,
          last_error: null,
          email_id: null,
          error_message: null,
          scheduled_at: null,
          started_at: null,
          completed_at: null,
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
        error: null,
      }),
      fetchPendingJobs: jest.fn(),
      updateJobState: jest.fn(),
      getFounderApplicationById: jest.fn().mockResolvedValue({
        data: {
          id: 'fa-1',
          email: 'founder@example.com',
          name: 'Founder',
          full_name: 'Founder Person',
          company_name: 'Acme',
          pitch_summary: null,
          industry: null,
          stage: null,
          deck_file_id: null,
          deck_path: null,
          website: null,
          twitter: null,
          linkedin: null,
          status: 'accepted',
          assigned_event_id: null,
          application_data: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
        error: null,
      }),
      getFounderApplicationByEmail: jest.fn(),
      insertFounderApplication: jest.fn(),
      updateFounderApplication: jest.fn().mockResolvedValue({ data: { id: 'fa-1' }, error: null }),
      getUserByEmail: jest.fn(),
      getUserById: jest.fn(),
      insertUser: jest.fn(),
      updateUser: jest.fn(),
      getFounderByUserId: jest.fn(),
      insertFounder: jest.fn(),
      getRoleAssignmentsByUserId: jest.fn(),
      listRoleAssignments: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'ra-judge-event',
            user_id: 'judge-1',
            role: 'judge',
            scope: 'event',
            scoped_id: 'event-1',
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
            created_by: 'admin-1',
            user: { id: 'judge-1', email: 'judge@example.com', name: 'Judge One' },
            assigned_by_user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
          },
          {
            id: 'ra-judge-global',
            user_id: 'judge-2',
            role: 'judge',
            scope: 'global',
            scoped_id: null,
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
            created_by: 'admin-1',
            user: { id: 'judge-2', email: 'judge2@example.com', name: 'Judge Two' },
            assigned_by_user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
          },
        ],
        error: null,
      }),
      insertRoleAssignment: jest.fn().mockResolvedValue({ data: { id: 'ra-new' }, error: null }),
      deleteRoleAssignment: jest.fn().mockResolvedValue({ data: { id: 'ra-judge-event' }, error: null }),
      listEvents: jest.fn().mockResolvedValue({ data: [event], error: null }),
      getEventById: jest.fn().mockResolvedValue({ data: event, error: null }),
      insertEvent: jest.fn().mockResolvedValue({ data: { ...event, id: 'event-2' }, error: null }),
      updateEvent: jest.fn().mockResolvedValue({ data: { ...event, status: 'archived' }, error: null }),
      listSponsors: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'sponsor-event',
            name: 'Event Sponsor',
            logo_url: null,
            website_url: null,
            tier: 'gold',
            placement_scope: 'event',
            event_id: 'event-1',
            end_date: '2026-05-01T00:00:00.000Z',
            pricing_cents: 250000,
            status: 'active',
            display_priority: 0,
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
          },
          {
            id: 'sponsor-site',
            name: 'Site Sponsor',
            logo_url: null,
            website_url: null,
            tier: 'silver',
            placement_scope: 'site-wide',
            event_id: null,
            end_date: '2026-05-01T00:00:00.000Z',
            pricing_cents: 100000,
            status: 'active',
            display_priority: 0,
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
          },
        ],
        error: null,
      }),
      insertSponsor: jest.fn().mockResolvedValue({
        data: {
          id: 'sponsor-new',
          name: 'New Sponsor',
          logo_url: null,
          website_url: null,
          tier: 'gold',
          placement_scope: 'event',
          event_id: 'event-1',
          end_date: '2026-06-01T00:00:00.000Z',
          pricing_cents: 250000,
          status: 'active',
          display_priority: 0,
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
        error: null,
      }),
      searchUsersByEmail: jest.fn(),
      listMentorIdsByEventId: jest.fn().mockResolvedValue({ data: ['mentor-1', 'mentor-2'], error: null }),
      listFounderIdsByEventId: jest.fn().mockResolvedValue({ data: ['founder-1', 'founder-2'], error: null }),
      listRecentMentorPairs: jest.fn().mockResolvedValue({ data: [], error: null }),
      insertMentorMatch: jest.fn().mockResolvedValue({
        data: {
          id: 'match-1',
          mentor_id: 'mentor-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'pending',
          founder_status: 'pending',
          mentor_accepted_at: null,
          founder_accepted_at: null,
          declined_by: null,
          notes: null,
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
        error: null,
      }),
      getMentorMatchById: jest.fn().mockResolvedValue({
        data: {
          id: 'match-1',
          mentor_id: 'mentor-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'pending',
          founder_status: 'pending',
          mentor_accepted_at: null,
          founder_accepted_at: null,
          declined_by: null,
          notes: null,
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
        error: null,
      }),
      deleteMentorMatchById: jest.fn().mockResolvedValue({
        data: {
          id: 'match-1',
          mentor_id: 'mentor-1',
          founder_id: 'founder-1',
          event_id: 'event-1',
          mentor_status: 'pending',
          founder_status: 'pending',
          mentor_accepted_at: null,
          founder_accepted_at: null,
          declined_by: null,
          notes: null,
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
        error: null,
      }),
      listRubricTemplates: jest.fn(),
      getRubricTemplateById: jest.fn(),
      insertRubricTemplate: jest.fn(),
      updateRubricTemplate: jest.fn(),
      listRubricVersionsByTemplateId: jest.fn(),
      getLatestRubricVersionByTemplateId: jest.fn(),
      insertRubricVersion: jest.fn(),
      listProducts: jest.fn(),
      getProductById: jest.fn(),
      insertProduct: jest.fn(),
      updateProduct: jest.fn(),
      deleteProduct: jest.fn(),
      listPricesByProductId: jest.fn(),
      getPriceById: jest.fn(),
      insertPrice: jest.fn(),
      updatePrice: jest.fn(),
      deletePrice: jest.fn(),
      getSubscriptionByStripeId: jest.fn(),
      getSubscriptionById: jest.fn(),
      listSubscriptionsByUserId: jest.fn(),
      requestSubscriptionCancellation: jest.fn(),
      upsertSubscription: jest.fn(),
      getTransactionByStripeEventId: jest.fn(),
      insertTransaction: jest.fn(),
      listEntitlementsByUserId: jest.fn(),
      insertEntitlement: jest.fn(),
      getContentById: jest.fn(),
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

  it('lists events with counts and display status', async () => {
    const response = await listEvents(buildRequest('http://localhost/api/admin/events', 'GET'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        name: 'April Demo Day',
        status: 'Upcoming',
        judge_count: 1,
        founder_count: 1,
      })
    );
  });

  it('creates an event and writes audit log', async () => {
    const response = await createEvent(
      buildRequest('http://localhost/api/admin/events', 'POST', {
        name: 'May Demo Day',
        start_date: '2026-05-01T10:00:00.000Z',
        end_date: '2026-05-01T12:00:00.000Z',
        description: 'May pitches',
        max_judges: 5,
        max_founders: 10,
      })
    );

    expect(response.status).toBe(201);
    expect(mockDb.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'May Demo Day' })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'event_created',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );
  });

  it('returns event detail', async () => {
    const response = await getEvent(buildRequest('http://localhost/api/admin/events/event-1', 'GET'), {
      params: Promise.resolve({ id: 'event-1' }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toEqual(expect.objectContaining({ id: 'event-1', status: 'Upcoming' }));
  });

  it('updates event and audit logs mutation', async () => {
    const response = await updateEvent(
      buildRequest('http://localhost/api/admin/events/event-1', 'PATCH', {
        name: 'Updated Name',
        status: 'live',
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.updateEvent).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ name: 'Updated Name', status: 'live' })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'event_updated',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );
  });

  it('soft deletes event by archiving status instead of hard delete', async () => {
    const response = await archiveEvent(buildRequest('http://localhost/api/admin/events/event-1', 'DELETE'), {
      params: Promise.resolve({ id: 'event-1' }),
    });
    expect(response.status).toBe(405);
    expect(mockDb.updateEvent).not.toHaveBeenCalledWith('event-1', { status: 'archived' });
    expect(mockDb.deleteEvent).toBeUndefined();
  });

  it('transitions event status using lifecycle route with audit logging', async () => {
    const response = await patchEventStatus(
      buildRequest('http://localhost/api/admin/events/event-1/status', 'PATCH', {
        new_status: 'Live',
        notes: 'Launching scoring now',
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.updateEvent).toHaveBeenCalledWith('event-1', expect.objectContaining({ status: 'live' }));
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'event_status_changed',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );
  });

  it('returns idempotent success for repeated lifecycle transition', async () => {
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'April Demo Day',
        description: 'Pitch event',
        status: 'live',
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        scoring_start: '2026-04-01T10:15:00.000Z',
        scoring_end: '2026-04-01T11:45:00.000Z',
        publishing_start: '2026-04-01T12:30:00.000Z',
        publishing_end: '2026-04-02T12:30:00.000Z',
        archived_at: null,
        starts_at: '2026-04-01T10:00:00.000Z',
        ends_at: '2026-04-01T12:00:00.000Z',
        config: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-03-25T00:00:00.000Z',
      },
      error: null,
    });

    const response = await patchEventStatus(
      buildRequest('http://localhost/api/admin/events/event-1/status', 'PATCH', { new_status: 'Live' }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.idempotent).toBe(true);
  });

  it('archives a live event and returns idempotent success on repeated archive requests', async () => {
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'April Demo Day',
        description: 'Pitch event',
        status: 'live',
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        scoring_start: '2026-04-01T10:15:00.000Z',
        scoring_end: '2026-04-01T11:45:00.000Z',
        publishing_start: '2026-04-01T12:30:00.000Z',
        publishing_end: '2026-04-02T12:30:00.000Z',
        archived_at: null,
        starts_at: '2026-04-01T10:00:00.000Z',
        ends_at: '2026-04-01T12:00:00.000Z',
        config: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-03-25T00:00:00.000Z',
      },
      error: null,
    });
    mockDb.updateEvent.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'April Demo Day',
        description: 'Pitch event',
        status: 'archived',
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        scoring_start: '2026-04-01T10:15:00.000Z',
        scoring_end: '2026-04-01T11:45:00.000Z',
        publishing_start: '2026-04-01T12:30:00.000Z',
        publishing_end: '2026-04-02T12:30:00.000Z',
        archived_at: '2026-04-01T12:05:00.000Z',
        starts_at: '2026-04-01T10:00:00.000Z',
        ends_at: '2026-04-01T12:00:00.000Z',
        config: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-04-01T12:05:00.000Z',
      },
      error: null,
    });

    const archiveResponse = await patchEventStatus(
      buildRequest('http://localhost/api/admin/events/event-1/status', 'PATCH', {
        new_status: 'Archived',
        notes: 'Scoring completed',
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );
    expect(archiveResponse.status).toBe(200);
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'event_status_changed',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );

    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'April Demo Day',
        description: 'Pitch event',
        status: 'archived',
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        scoring_start: '2026-04-01T10:15:00.000Z',
        scoring_end: '2026-04-01T11:45:00.000Z',
        publishing_start: '2026-04-01T12:30:00.000Z',
        publishing_end: '2026-04-02T12:30:00.000Z',
        archived_at: '2026-04-01T12:05:00.000Z',
        starts_at: '2026-04-01T10:00:00.000Z',
        ends_at: '2026-04-01T12:00:00.000Z',
        config: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-04-01T12:05:00.000Z',
      },
      error: null,
    });

    const repeatedArchiveResponse = await patchEventStatus(
      buildRequest('http://localhost/api/admin/events/event-1/status', 'PATCH', { new_status: 'Archived' }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );
    expect(repeatedArchiveResponse.status).toBe(200);
    await expect(repeatedArchiveResponse.json()).resolves.toEqual(
      expect.objectContaining({ success: true, idempotent: true })
    );
  });

  it('rejects attempts to revert archived events back to live', async () => {
    mockDb.getEventById.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        name: 'April Demo Day',
        description: 'Pitch event',
        status: 'archived',
        start_date: '2026-04-01T10:00:00.000Z',
        end_date: '2026-04-01T12:00:00.000Z',
        scoring_start: '2026-04-01T10:15:00.000Z',
        scoring_end: '2026-04-01T11:45:00.000Z',
        publishing_start: '2026-04-01T12:30:00.000Z',
        publishing_end: '2026-04-02T12:30:00.000Z',
        archived_at: '2026-04-01T12:05:00.000Z',
        starts_at: '2026-04-01T10:00:00.000Z',
        ends_at: '2026-04-01T12:00:00.000Z',
        config: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-04-01T12:05:00.000Z',
      },
      error: null,
    });

    const response = await patchEventStatus(
      buildRequest('http://localhost/api/admin/events/event-1/status', 'PATCH', { new_status: 'Live' }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        message: 'Invalid transition. Archived events cannot transition to Live.',
      })
    );
  });

  it('updates scoring window with event-boundary validation and auditing', async () => {
    const response = await patchScoringWindow(
      buildRequest('http://localhost/api/admin/events/event-1/scoring-window', 'PATCH', {
        scoring_start: '2026-04-01T10:20:00.000Z',
        scoring_end: '2026-04-01T11:40:00.000Z',
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockDb.updateEvent).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        scoring_start: '2026-04-01T10:20:00.000Z',
        scoring_end: '2026-04-01T11:40:00.000Z',
      })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'scoring_window_updated',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );
  });

  it('rejects scoring windows outside event boundaries with 400', async () => {
    const response = await patchScoringWindow(
      buildRequest('http://localhost/api/admin/events/event-1/scoring-window', 'PATCH', {
        scoring_start: '2026-03-31T23:00:00.000Z',
        scoring_end: '2026-04-01T11:00:00.000Z',
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(400);
  });

  it('updates publishing window and writes audit event', async () => {
    const response = await patchPublishingWindow(
      buildRequest('http://localhost/api/admin/events/event-1/publishing-window', 'PATCH', {
        publishing_start: '2026-04-01T13:00:00.000Z',
        publishing_end: '2026-04-02T13:00:00.000Z',
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'publishing_window_updated',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );
  });

  it('lists event-scoped sponsors from dedicated event sponsors route', async () => {
    const response = await listEventSponsors(
      buildRequest('http://localhost/api/admin/events/event-1/sponsors', 'GET'),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toHaveLength(2);
    expect(payload.data.map((sponsor: { id: string }) => sponsor.id)).toEqual(
      expect.arrayContaining(['sponsor-event', 'sponsor-site'])
    );
  });

  it('adds event sponsor through dedicated event sponsors route', async () => {
    const response = await addEventSponsor(
      buildRequest('http://localhost/api/admin/events/event-1/sponsors', 'POST', {
        name: 'New Sponsor',
        tier: 'gold',
        end_date: '2026-06-01T00:00:00.000Z',
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );

    expect(response.status).toBe(201);
    expect(mockDb.insertSponsor).toHaveBeenCalledWith(
      expect.objectContaining({ placement_scope: 'event', event_id: 'event-1' })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'sponsor_added',
      'admin-1',
      expect.objectContaining({ resource_type: 'sponsor' }),
      expect.any(Object)
    );
  });


  it('loads judge candidates from role assignments and saves assignments', async () => {
    const getResponse = await getJudgeAssignments(buildRequest('http://localhost/api/admin/events/event-1/assign-judges', 'GET'), {
      params: Promise.resolve({ id: 'event-1' }),
    });
    expect(getResponse.status).toBe(200);
    const getPayload = await getResponse.json();
    expect(getPayload.data.candidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: 'judge@example.com' })])
    );

    const postResponse = await assignJudges(
      buildRequest('http://localhost/api/admin/events/event-1/assign-judges', 'POST', {
        judge_user_ids: ['judge-2'],
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );
    expect(postResponse.status).toBe(200);
    expect(mockDb.insertRoleAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'judge-2', role: 'judge', scope: 'event' })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'event_judges_assigned',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );
  });

  it('loads founder candidates and assigns accepted founder applications', async () => {
    mockDb.queryTable.mockResolvedValueOnce({
      data: [
        {
          id: 'fa-1',
          email: 'founder@example.com',
          name: 'Founder',
          full_name: 'Founder Person',
          company_name: 'Acme',
          pitch_summary: null,
          industry: null,
          stage: null,
          deck_file_id: null,
          deck_path: null,
          website: null,
          twitter: null,
          linkedin: null,
          status: 'accepted',
          assigned_event_id: null,
          application_data: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const getResponse = await getFounderAssignments(buildRequest('http://localhost/api/admin/events/event-1/assign-founders', 'GET'), {
      params: Promise.resolve({ id: 'event-1' }),
    });
    expect(getResponse.status).toBe(200);
    const getPayload = await getResponse.json();
    expect(getPayload.data.candidates[0]).toEqual(expect.objectContaining({ email: 'founder@example.com' }));

    mockDb.queryTable.mockResolvedValueOnce({ data: [], error: null });
    const postResponse = await assignFounders(
      buildRequest('http://localhost/api/admin/events/event-1/assign-founders', 'POST', {
        founder_application_ids: ['fa-1'],
      }),
      { params: Promise.resolve({ id: 'event-1' }) }
    );
    expect(postResponse.status).toBe(200);
    expect(mockDb.updateFounderApplication).toHaveBeenCalledWith(
      'fa-1',
      expect.objectContaining({ status: 'assigned', assigned_event_id: 'event-1' })
    );
    expect(mockedAuditLog).toHaveBeenCalledWith(
      'event_founders_assigned',
      'admin-1',
      expect.objectContaining({ resource_type: 'event' }),
      expect.any(Object)
    );
  });

  it('generates mentor matches and reports repeat-prevention conflicts', async () => {
    mockDb.listFounderIdsByEventId.mockResolvedValue({ data: ['founder-1'], error: null });
    mockDb.listRecentMentorPairs.mockResolvedValue({
      data: [{ mentor_id: 'mentor-1', founder_id: 'founder-1', created_at: new Date().toISOString() }],
      error: null,
    });
    mockDb.insertMentorMatch.mockResolvedValueOnce({
      data: {
        id: 'match-2',
        mentor_id: 'mentor-2',
        founder_id: 'founder-1',
        event_id: 'event-1',
        mentor_status: 'pending',
        founder_status: 'pending',
        mentor_accepted_at: null,
        founder_accepted_at: null,
        declined_by: null,
        notes: null,
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-03-25T00:00:00.000Z',
      },
      error: null,
    });

    const response = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 2,
        exclude_previous_pairs_months: 12,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ matches_created: 1, conflicts: 1 });
  });

  it('validates mentor matching payload boundaries', async () => {
    const negativeMonths = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 1,
        exclude_previous_pairs_months: -1,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(negativeMonths.status).toBe(400);

    const nonIntegerMonths = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 1,
        exclude_previous_pairs_months: 1.2,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(nonIntegerMonths.status).toBe(400);

    const zeroMonths = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 1,
        exclude_previous_pairs_months: 0,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(zeroMonths.status).toBe(200);

    const twelveMonths = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 1,
        exclude_previous_pairs_months: 12,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(twelveMonths.status).toBe(200);
  });

  it('returns 400 for invalid JSON body in mentor matching route', async () => {
    const invalidJsonRequest = new NextRequest(
      new Request('http://localhost/api/admin/events/event-1/mentors/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid',
      })
    );

    const response = await generateMentorMatches(invalidJsonRequest, {
      params: Promise.resolve({ eventId: 'event-1' }),
    });
    expect(response.status).toBe(400);
  });

  it('returns auth failure for mentor matching routes', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    );

    const response = await generateMentorMatches(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/match', 'POST', {
        num_mentors_per_founder: 1,
        exclude_previous_pairs_months: 12,
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );
    expect(response.status).toBe(403);
  });

  it('creates and deletes manual mentor matches', async () => {
    const createResponse = await createMentorMatch(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/matches', 'POST', {
        mentor_id: 'mentor-1',
        founder_id: 'founder-1',
        notes: 'manual override',
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) }
    );

    expect(createResponse.status).toBe(200);
    expect(mockDb.insertMentorMatch).toHaveBeenCalledWith(
      expect.objectContaining({ mentor_id: 'mentor-1', founder_id: 'founder-1', event_id: 'event-1' })
    );

    const deleteResponse = await deleteMentorMatch(
      buildRequest('http://localhost/api/admin/events/event-1/mentors/matches/match-1', 'DELETE'),
      { params: Promise.resolve({ eventId: 'event-1', matchId: 'match-1' }) }
    );

    expect(deleteResponse.status).toBe(200);
    expect(mockDb.deleteMentorMatchById).toHaveBeenCalledWith('match-1');
  });

  it('enforces admin guard for events endpoint', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await listEvents(buildRequest('http://localhost/api/admin/events', 'GET'));
    expect(response.status).toBe(401);
  });
});
