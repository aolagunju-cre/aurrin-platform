'use client';

import { useEffect, useRef, useState } from 'react';
import type { DemoPersonaDefinition, DemoPersona } from '@/src/lib/auth/request-auth';

const ROLE_COLORS: Record<DemoPersona, string> = {
  admin: 'bg-violet-500',
  judge: 'bg-amber-500',
  founder: 'bg-emerald-500',
  mentor: 'bg-blue-500',
  subscriber: 'bg-pink-500',
  audience: 'bg-neutral-500',
};

export function DemoRoleSwitcherClient({
  currentPersona,
  personas,
}: {
  currentPersona: DemoPersona;
  personas: DemoPersonaDefinition[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const currentDef = personas.find((p) => p.persona === currentPersona);

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Expanded panel */}
      <div
        className={`mb-2 w-72 origin-bottom-right rounded-2xl border border-default-200 bg-background/95 p-3 shadow-xl backdrop-blur-md transition-all duration-200 ${
          open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-default-400">
          Switch Role
        </p>
        <div className="flex flex-col gap-0.5">
          {personas.map((persona) => {
            const isCurrent = persona.persona === currentPersona;
            return (
              <a
                key={persona.id}
                href={isCurrent ? undefined : `/api/demo/switch?persona=${persona.persona}`}
                aria-current={isCurrent ? 'true' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isCurrent
                    ? 'bg-default-100'
                    : 'cursor-pointer hover:bg-default-50'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${ROLE_COLORS[persona.persona]}`}
                >
                  {persona.label[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      isCurrent ? 'text-foreground' : 'text-default-600'
                    }`}
                  >
                    {persona.label}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-default-400">
                    {persona.description}
                  </p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 text-[11px] font-medium text-violet-500">
                    Active
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2.5 rounded-full border border-default-200 bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-md transition-all hover:border-violet-500 hover:shadow-xl ${
          open ? 'ring-2 ring-violet-500/20' : ''
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${ROLE_COLORS[currentPersona]}`}
        >
          {currentDef?.label[0] ?? '?'}
        </span>
        <span className="text-sm font-medium text-foreground">{currentDef?.label ?? 'Demo'}</span>
        <svg
          className={`h-3 w-3 text-default-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
