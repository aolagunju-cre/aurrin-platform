import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminFoundersPage from '../src/app/(protected)/admin/founders/page';

jest.mock('@heroui/button', () => {
  const React = require('react');

  return {
    Button: ({ children, onPress, onClick, ...props }: any) =>
      React.createElement('button', { ...props, onClick: onPress ?? onClick }, children),
  };
});

describe('AdminFoundersPage', () => {
  function renderPage(): void {
    render(<AdminFoundersPage />);
  }

  beforeEach(() => {
    jest.restoreAllMocks();

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/admin/founders')) {
        return mockResponse(200, {
          success: true,
          data: [
            {
              id: 'app-1',
              name: 'Founder One',
              email: 'founder1@example.com',
              application_status: 'Pending',
              assigned_event: null,
              submission_date: '2026-03-20T10:00:00.000Z',
            },
            {
              id: 'app-2',
              name: 'Founder Two',
              email: 'founder2@example.com',
              application_status: 'Assigned',
              assigned_event: 'Spring Demo Day',
              submission_date: '2026-03-21T10:00:00.000Z',
            },
          ],
        });
      }

      return mockResponse(500, { success: false, message: 'Unhandled request' });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('renders required founders table columns', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Founders Table')).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /assigned event/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /submission date/i })).toBeInTheDocument();
  });

  it('filters founders by application status', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Founders Table')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Assigned' }));

    const table = screen.getByLabelText('Founders Table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Founder Two')).toBeInTheDocument();
    expect(screen.queryByText('Founder One')).not.toBeInTheDocument();
  });
});
