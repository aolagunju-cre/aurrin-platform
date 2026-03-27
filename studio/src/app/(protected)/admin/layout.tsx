import React from 'react';
import { AdminShell } from '../../../components/admin/AdminShell';
import { verifyAdminForServerComponent } from '../../../lib/auth/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.ReactElement> {
  const authResult = await verifyAdminForServerComponent();

  if (!authResult.ok) {
    const title = authResult.status === 403 ? 'Forbidden' : 'Unauthorized';
    return (
      <main role="main" className="container mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-lg text-default-500 mt-1">Admin access is required to view this area.</p>
      </main>
    );
  }

  return <AdminShell userEmail={authResult.context?.email ?? authResult.context?.auth.email ?? 'admin'}>{children}</AdminShell>;
}
