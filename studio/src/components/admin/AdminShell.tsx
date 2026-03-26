import React from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

interface AdminShellProps {
  userEmail: string;
  children: React.ReactNode;
}

export function AdminShell({ userEmail, children }: AdminShellProps): React.ReactElement {
  return (
    <div>
      <AdminHeader userEmail={userEmail} />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <AdminSidebar />
        <main role="main" style={{ flex: 1, padding: '1rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
