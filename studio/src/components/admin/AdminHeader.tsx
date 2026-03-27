import React from 'react';

interface AdminHeaderProps {
  userEmail: string;
}

export function AdminHeader({ userEmail }: AdminHeaderProps): React.ReactElement {
  return (
    <header className="h-14 border-b border-default-200 bg-background/80 backdrop-blur-md px-6 flex items-center justify-between">
      <div className="text-sm text-default-500">
        Signed in as <span className="font-medium text-foreground">{userEmail}</span>
      </div>
      <a
        href="/auth/sign-out"
        aria-label="Logout"
        className="text-sm text-default-500 hover:text-foreground transition-colors"
      >
        Logout
      </a>
    </header>
  );
}
