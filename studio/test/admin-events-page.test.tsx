import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminEventsPage from '../src/app/(protected)/admin/events/page';
import AdminEventDetailPage from '../src/app/(protected)/admin/events/[id]/page';
import AdminEventSponsorsPage from '../src/app/(protected)/admin/events/[id]/sponsors/page';
import { useParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}));

const mockedUseParams = useParams as jest.Mock;

describe('AdminEventsPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/admin/events') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: [
            {
              id: 'event-1',
              name: 'Spring Pitch Day',
              status: 'Upcoming',
              start_date: '2026-04-01T09:00:00.000Z',
              end_date: '2026-04-01T11:00:00.000Z',
              judge_count: 4,
              founder_count: 8,
            },
            {
              id: 'event-2',
              name: 'Live Finals',
              status: 'Live',
              start_date: '2026-04-05T09:00:00.000Z',
              end_date: '2026-04-05T11:00:00.000Z',
              judge_count: 5,
              founder_count: 10,
            },
          ],
        });
      }

      if (url.endsWith('/api/admin/events') && method === 'POST') {
        return mockResponse(201, { success: true });
      }

      return mockResponse(500, { success: false, message: 'Unhandled request' });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('renders required table columns and Create Event trigger', async () => {
    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Events Table')).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /dates/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /judge count/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /founder count/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Event' })).toBeInTheDocument();
    expect(screen.getByText('Spring Pitch Day')).toBeInTheDocument();
    expect(screen.getByText('Live Finals')).toBeInTheDocument();
  });

  it('filters events by status with Upcoming/Live/Archived controls', async () => {
    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Events Table')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Live' }));

    const table = screen.getByLabelText('Events Table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Live Finals')).toBeInTheDocument();
    expect(screen.queryByText('Spring Pitch Day')).not.toBeInTheDocument();
  });
});

describe('AdminEventDetailPage lifecycle controls', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedUseParams.mockReturnValue({ id: 'event-1' });

    const eventState = {
      id: 'event-1',
      name: 'Spring Pitch Day',
      description: 'Event details',
      status: 'Upcoming',
      start_date: '2026-04-01T09:00:00.000Z',
      end_date: '2026-04-01T11:00:00.000Z',
      scoring_start: '2026-04-01T09:00:00.000Z',
      scoring_end: '2026-04-01T10:00:00.000Z',
      publishing_start: '2026-04-01T10:30:00.000Z',
      publishing_end: '2026-04-01T11:00:00.000Z',
      logo_url: 'https://example.com/logo.png',
      image_url: null,
    };

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/admin/events/event-1') && method === 'GET') {
        return mockResponse(200, { success: true, data: eventState });
      }

      if (url.endsWith('/api/admin/events/event-1/status') && method === 'PATCH') {
        eventState.status = 'Live';
        return mockResponse(200, { success: true, data: eventState });
      }

      if (url.endsWith('/api/admin/events/event-1') && method === 'PATCH') {
        return mockResponse(200, { success: true });
      }

      if (url.endsWith('/api/admin/events/event-1/scoring-window') && method === 'PATCH') {
        return mockResponse(400, { success: false, message: 'scoring_start must be before scoring_end.' });
      }

      if (url.endsWith('/api/admin/events/event-1/publishing-window') && method === 'PATCH') {
        return mockResponse(200, { success: true });
      }

      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('renders Go Live for Upcoming status and requires confirmation modal text', async () => {
    render(<AdminEventDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Go Live' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Go Live' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getByText('Status:')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    });
  });

  it('shows window mutation API validation errors in-page', async () => {
    render(<AdminEventDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('scoring_start must be before scoring_end.');
    });
  });

  it('shows directory publishing controls only after wrap-up prerequisites and supports auto-publish action', async () => {
    const archivedState = {
      id: 'event-1',
      name: 'Spring Pitch Day',
      description: 'Event details',
      status: 'Archived',
      start_date: '2026-04-01T09:00:00.000Z',
      end_date: '2026-04-01T11:00:00.000Z',
      scoring_start: '2026-04-01T09:00:00.000Z',
      scoring_end: '2026-04-01T10:00:00.000Z',
      publishing_start: '2026-01-01T10:30:00.000Z',
      publishing_end: '2026-04-01T11:00:00.000Z',
      logo_url: null,
      image_url: null,
    };

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/admin/events/event-1') && method === 'GET') {
        return mockResponse(200, { success: true, data: archivedState });
      }

      if (url.endsWith('/api/admin/events/event-1/directory-publishing') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: {
            publishing_allowed: true,
            candidates: [
              {
                founder_id: 'founder-1',
                founder_name: 'Founder One',
                founder_email: 'founder1@example.com',
                company_name: 'Orbit Labs',
                pitch_id: 'pitch-1',
                visible_in_directory: false,
                is_published: true,
                public_profile_slug: 'orbit-labs',
                application_status: 'accepted',
                eligible_for_auto_publish: true,
              },
            ],
          },
        });
      }

      if (url.endsWith('/api/admin/events/event-1/directory-publishing') && method === 'POST') {
        return mockResponse(200, { success: true });
      }

      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<AdminEventDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Auto-Publish Accepted Founders' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Publish Accepted Founders' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/events/event-1/directory-publishing',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});

describe('AdminEventSponsorsPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedUseParams.mockReturnValue({ id: 'event-1' });

    const sponsors = [
      {
        id: 'sponsor-1',
        name: 'Acme Ventures',
        logo: 'https://example.com/logo.png',
        tier: 'silver',
        scope: 'event',
        event: 'event-1',
      },
    ];

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/admin/events/event-1/sponsors') && method === 'GET') {
        return mockResponse(200, { success: true, data: sponsors });
      }

      if (url.endsWith('/api/admin/events/event-1/sponsors') && method === 'POST') {
        sponsors.push({
          id: 'sponsor-2',
          name: 'Beta Capital',
          logo: null,
          tier: 'gold',
          scope: 'site-wide',
          event: null,
        });
        return mockResponse(201, { success: true });
      }

      if (url.endsWith('/api/admin/sponsors/sponsor-1') && method === 'DELETE') {
        const index = sponsors.findIndex((sponsor) => sponsor.id === 'sponsor-1');
        if (index >= 0) sponsors.splice(index, 1);
        return mockResponse(200, { success: true });
      }

      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('supports add and delete sponsor interactions with visible list updates', async () => {
    render(<AdminEventSponsorsPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Ventures')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('sponsor name'), { target: { value: 'Beta Capital' } });
    fireEvent.change(screen.getByLabelText('sponsor tier'), { target: { value: 'gold' } });
    fireEvent.change(screen.getByLabelText('sponsor scope'), { target: { value: 'site-wide' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Sponsor' }));

    await waitFor(() => {
      expect(screen.getByText('Beta Capital')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    await waitFor(() => {
      expect(screen.queryByText('Acme Ventures')).not.toBeInTheDocument();
    });
  });
});
