import React from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

interface AdminShellProps {
  userEmail: string;
  children: React.ReactNode;
}

export function AdminShell({ userEmail, children }: AdminShellProps): React.ReactElement {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <AdminHeader userEmail={userEmail} />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main role="main" className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
