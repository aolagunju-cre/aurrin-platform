import React from 'react';

const links = [
  { label: 'Events', href: '/admin/events' },
  { label: 'Rubrics', href: '/admin/rubrics' },
  { label: 'Founders', href: '/admin/founders' },
  { label: 'Roles', href: '/admin/roles' },
  { label: 'Sponsors', href: '/admin/sponsors' },
  { label: 'Analytics', href: '/admin/analytics' },
];

export function AdminSidebar(): React.ReactElement {
  return (
    <aside aria-label="Admin Sidebar" style={{ minWidth: 220, borderRight: '1px solid #ddd', padding: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>Admin</h2>
      <nav>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {links.map((link) => (
            <li key={link.href} style={{ marginBottom: '0.5rem' }}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
