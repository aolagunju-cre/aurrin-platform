import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminRolesPage from '../src/app/(protected)/admin/roles/page';

describe('AdminRolesPage', () => {
  const baseAssignments = [
    {
      id: 'ra-1',
      role: 'judge',
      scope: 'global',
      scoped_id: null,
      assigned_at: '2026-03-26T00:00:00.000Z',
      user: { id: 'user-1', email: 'judge@example.com', name: 'Judge User' },
      assigned_by: { id: 'admin-1', email: 'admin@example.com', name: 'Admin User' },
    },
  ];

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

      if (url.includes('/api/admin/roles') && method === 'GET') {
        return mockResponse(200, { success: true, data: baseAssignments });
      }

      if (url.includes('/api/admin/users/search')) {
        return mockResponse(200, {
          success: true,
          data: [{ id: 'user-2', email: 'founder@example.com', name: 'Founder User' }],
        });
      }

      if (url.includes('/api/admin/roles') && method === 'POST') {
        return mockResponse(201, { success: true });
      }

      if (url.includes('/api/admin/roles/ra-1') && method === 'DELETE') {
        return mockResponse(200, { success: true });
      }

      return mockResponse(500, { success: false, message: 'Unhandled request' });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders role table with required columns and actions', async () => {
    render(<AdminRolesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Role Assignments Table')).toBeInTheDocument();
    });

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('Assigned By')).toBeInTheDocument();
    expect(screen.getByText('Assigned At')).toBeInTheDocument();
    expect(screen.getByText('Judge User (judge@example.com)')).toBeInTheDocument();
    expect(screen.getByText('Judge')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign Role' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke Role' })).toBeInTheDocument();
  });

  it('opens role assignment modal and exposes exact role options', async () => {
    render(<AdminRolesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Assign Role' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Assign Role' }));
    expect(screen.getByRole('dialog', { name: 'Assign Role' })).toBeInTheDocument();

    const roleSelect = screen.getByLabelText('Role');
    fireEvent.mouseDown(roleSelect);

    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Judge' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Founder' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mentor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Subscriber' })).toBeInTheDocument();
  });

  it('requires explicit confirmation before revoking role', async () => {
    render(<AdminRolesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Revoke Role' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Role' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/roles/ra-1', { method: 'DELETE' });
  });
});
