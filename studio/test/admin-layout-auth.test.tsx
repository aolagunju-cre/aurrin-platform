import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminLayout from '../src/app/(protected)/admin/layout';
import { verifyAdminFromAuthHeader } from '../src/lib/auth/admin';

jest.mock('next/headers', () => ({
  headers: jest.fn(async () => ({
    get: () => 'Bearer token',
  })),
}));

jest.mock('../src/lib/auth/admin', () => ({
  verifyAdminFromAuthHeader: jest.fn(),
}));

const mockedVerifyAdminFromAuthHeader = verifyAdminFromAuthHeader as jest.MockedFunction<typeof verifyAdminFromAuthHeader>;

describe('Admin layout auth', () => {
  beforeEach(() => {
    mockedVerifyAdminFromAuthHeader.mockReset();
  });

  it('renders admin shell links and logout for authorized admins', async () => {
    mockedVerifyAdminFromAuthHeader.mockResolvedValue({
      ok: true,
      context: {
        userId: 'admin-1',
        auth: {
          sub: 'admin-1',
          email: 'admin@example.com',
          iat: 0,
          exp: 9999999999,
          aud: 'authenticated',
          iss: 'https://example.supabase.co/auth/v1',
        },
      },
    });

    const view = await AdminLayout({ children: <div>Admin content</div> });
    render(view);

    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Rubrics')).toBeInTheDocument();
    expect(screen.getByText('Founders')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('blocks unauthenticated users', async () => {
    mockedVerifyAdminFromAuthHeader.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Unauthorized',
    });

    const view = await AdminLayout({ children: <div>Hidden content</div> });
    render(view);

    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('blocks authenticated non-admin users', async () => {
    mockedVerifyAdminFromAuthHeader.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });

    const view = await AdminLayout({ children: <div>Hidden content</div> });
    render(view);

    expect(screen.getByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });
});
