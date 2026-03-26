import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminEventsPage from '../src/app/(protected)/admin/events/page';

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

    expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'dates' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'judge count' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'founder count' })).toBeInTheDocument();
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
