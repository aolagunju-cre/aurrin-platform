import React from 'react';
import { headers } from 'next/headers';
import { AdminShell } from '../../../components/admin/AdminShell';
import { verifyAdminFromAuthHeader } from '../../../lib/auth/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.ReactElement> {
  const headerStore = await headers();
  const authResult = await verifyAdminFromAuthHeader(headerStore.get('authorization'));

  if (!authResult.ok) {
    const title = authResult.status === 403 ? 'Forbidden' : 'Unauthorized';
    return (
      <main role="main" style={{ padding: '2rem' }}>
        <h1>{title}</h1>
        <p>Admin access is required to view this area.</p>
      </main>
    );
  }

  return <AdminShell userEmail={authResult.context?.auth.email ?? 'admin'}>{children}</AdminShell>;
}
