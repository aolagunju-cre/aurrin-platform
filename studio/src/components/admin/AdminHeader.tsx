import React from 'react';

interface AdminHeaderProps {
  userEmail: string;
}

export function AdminHeader({ userEmail }: AdminHeaderProps): React.ReactElement {
  return (
    <header
      style={{
        borderBottom: '1px solid #ddd',
        padding: '0.75rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>Signed in as {userEmail}</div>
      <a href="/public/apply" aria-label="Logout">
        Logout
      </a>
    </header>
  );
}
