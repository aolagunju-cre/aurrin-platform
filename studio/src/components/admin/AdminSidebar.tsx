'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

const links = [
  { label: 'Events', href: '/admin/events' },
  { label: 'Rubrics', href: '/admin/rubrics' },
  { label: 'Founders', href: '/admin/founders' },
  { label: 'Donations', href: '/admin/donations' },
  { label: 'Roles', href: '/admin/roles' },
  { label: 'Sponsors', href: '/admin/sponsors' },
  { label: 'Analytics', href: '/admin/analytics' },
];

export function AdminSidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Admin Sidebar"
      className="min-w-[240px] border-r border-default-200 bg-default-50 dark:bg-default-50/5 px-3 py-6"
    >
      <h2 className="mb-6 px-4 text-sm font-semibold uppercase tracking-wider text-default-400">
        Admin
      </h2>
      <nav>
        <ul className="flex flex-col gap-1">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-colors ${
                    isActive
                      ? 'bg-violet-500/10 font-medium text-violet-400'
                      : 'text-default-500 hover:bg-default-100 hover:text-foreground'
                  }`}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
