'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { clearAllUserData, clearRecentReports, setThemePref, useInvestorProfile, useRecentReports, useThemePref } from '@/lib/profileStore';
import type { ThemePref } from '@/lib/theme';
import { Button, SegmentedControl, Sheet } from './ui';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Automatico' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

const ROW = 'pressable flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 disabled:opacity-50 disabled:hover:bg-transparent';

/** Top-bar button opening the settings sheet: appearance, saved data, start over. */
export function SettingsMenu() {
  const ref = useRef<HTMLDialogElement>(null);
  const profile = useInvestorProfile();
  const recent = useRecentReports();
  const theme = useThemePref();
  const [confirming, setConfirming] = useState(false);
  const close = () => ref.current?.close();

  function startOver() {
    clearAllUserData();
    // Full reload also drops in-memory state (last search, flash messages).
    window.location.replace('/profilo');
  }

  return (
    <>
      <button
        type="button"
        aria-label="Impostazioni"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        className="pressable -mr-2 grid h-11 w-11 place-items-center rounded-lg text-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.375rem] w-[1.375rem]">
          <path d="M4 7h9m4 0h3M4 17h3m4 0h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="15" cy="7" r="2.25" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="9" cy="17" r="2.25" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <Sheet ref={ref} title="Impostazioni" onClose={() => setConfirming(false)}>
        <section aria-labelledby="h-set-theme" className="mt-5">
          <h3 id="h-set-theme" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Aspetto
          </h3>
          <SegmentedControl label="Tema" value={theme} options={THEMES} onChange={setThemePref} />
        </section>

        <section aria-labelledby="h-set-data" className="mt-6">
          <h3 id="h-set-data" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            I tuoi dati
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {profile && (
              <li>
                <Link href="/profilo" onClick={close} className={ROW}>
                  <span className="font-medium">Modifica profilo investitore</span>
                  <Chevron />
                </Link>
              </li>
            )}
            <li>
              <button type="button" onClick={clearRecentReports} disabled={recent.length === 0} className={ROW}>
                <span className="font-medium">Cancella visti di recente</span>
                <span className="text-sm text-muted">{recent.length > 0 ? recent.length : 'Vuoto'}</span>
              </button>
            </li>
          </ul>
          <p className="mt-2 text-sm text-muted">Profilo e preferenze sono salvati solo in questo browser.</p>
        </section>

        <section aria-labelledby="h-set-reset" className="mt-6">
          <h3 id="h-set-reset" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Ricomincia da zero
          </h3>
          {confirming ? (
            <div role="alert" className="rounded-2xl border border-error-line bg-error-soft p-4">
              <p className="font-medium text-error">Cancellare tutto?</p>
              <p className="mt-1 text-sm text-ink">
                Profilo, benchmark scelto e cronologia verranno eliminati e ripartirai dal questionario. Non si può annullare.
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
                  Annulla
                </Button>
                <Button variant="danger" className="flex-1" onClick={startOver}>
                  Cancella tutto
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">Elimina profilo, benchmark scelto e cronologia, poi riparti dal questionario. Il tema resta com&apos;è.</p>
              <Button variant="danger" block className="mt-3" onClick={() => setConfirming(true)}>
                Ricomincia da zero
              </Button>
            </>
          )}
        </section>

        <Button variant="ghost" block className="mt-4" onClick={close}>
          Chiudi
        </Button>
      </Sheet>
    </>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted">
      <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
