import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminLayout from '../src/app/(protected)/admin/layout';
import { verifyAdminForServerComponent } from '../src/lib/auth/admin';

jest.mock('../src/lib/auth/admin', () => ({
  verifyAdminForServerComponent: jest.fn(),
}));

const mockedVerifyAdminForServerComponent = verifyAdminForServerComponent as jest.MockedFunction<
  typeof verifyAdminForServerComponent
>;

describe('Admin layout auth', () => {
  beforeEach(() => {
    mockedVerifyAdminForServerComponent.mockReset();
  });

  it('renders admin shell links and logout for authorized admins', async () => {
    mockedVerifyAdminForServerComponent.mockResolvedValue({
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
    mockedVerifyAdminForServerComponent.mockResolvedValue({
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
    mockedVerifyAdminForServerComponent.mockResolvedValue({
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
