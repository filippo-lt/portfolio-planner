'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { useInvestorProfile } from '@/lib/profileStore';
import { SettingsMenu } from './SettingsMenu';
import { cx } from './ui';

const TABS = [
  {
    href: '/',
    label: 'Cerca',
    match: (p: string) => p === '/' || p.startsWith('/report'),
    icon: (
      <path
        d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.6-1.9L20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
  {
    href: '/profilo',
    label: 'Profilo',
    match: (p: string) => p.startsWith('/profilo'),
    icon: (
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
];

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] sm:bg-bg/85 sm:backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-lg font-semibold tracking-tight">
          <span aria-hidden="true" className="btn-primary grid h-7 w-7 place-items-center rounded-lg text-accent-fg">
            <svg viewBox="0 0 20 20" className="h-4 w-4">
              <path
                d="M3 14l4-4 3 3 7-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Analisi Strumento
        </Link>
        <div className="flex items-center gap-1">
          <Suspense fallback={null}>
            <DesktopNav />
          </Suspense>
          <SettingsMenu />
        </div>
      </div>
    </header>
  );
}

function DesktopNav() {
  const path = usePathname();
  const profile = useInvestorProfile();
  if (!profile) return null;
  return (
    <nav aria-label="Principale" className="hidden gap-1 sm:flex">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.match(path) ? 'page' : undefined}
          className={cx(
            'pressable inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium',
            t.match(path) ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile-only bottom tab bar, hidden until the profile exists (onboarding is a linear flow). */
export function TabBar() {
  return (
    <Suspense fallback={null}>
      <TabBarInner />
    </Suspense>
  );
}

function TabBarInner() {
  const path = usePathname();
  const profile = useInvestorProfile();
  if (!profile) return null;
  return (
    <nav
      data-tabbar
      aria-label="Principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const on = t.match(path);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'pressable flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                  on ? 'text-accent' : 'text-muted',
                )}
              >
                <span
                  className={cx(
                    'grid h-7 w-14 place-items-center rounded-full transition-colors',
                    on && 'bg-accent-soft',
                  )}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.375rem] w-[1.375rem]">
                    {t.icon}
                  </svg>
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
