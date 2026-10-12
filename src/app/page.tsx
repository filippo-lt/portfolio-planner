'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clearRecentReports, flash, useInvestorProfile, useRecentReports } from '@/lib/profileStore';
import type { InstrumentType, SymbolCandidate } from '@/lib/data/types';
import { exchangeLabel, nameTags, typeLabel } from '@/lib/labels';
import { Button, Callout, Chip, PageLoading, Skeleton, ToneIcon, cx } from '@/components/ui';

type State = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; query: string; results: SymbolCandidate[] };

const FALLBACK_ERR = 'Ricerca non riuscita. Controlla la connessione e riprova.';

/** Keeps the last search across client navigations (back from a report). */
let lastSearch: { q: string; state: State } | null = null;

const EXAMPLES = [
  { q: 'IE00BK5BQT80', label: 'IE00BK5BQT80', note: 'ISIN di un ETF' },
  { q: 'AAPL', label: 'AAPL', note: 'ticker di un’azione' },
  { q: 'MSCI World', label: 'MSCI World', note: 'per nome' },
];

function groupByName(results: SymbolCandidate[]) {
  const groups = new Map<string, SymbolCandidate[]>();
  for (const r of results) {
    const k = `${r.name}|${r.type}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  // Listings most relevant to an Italian investor first: Borsa Italiana, then EUR.
  const rank = (r: SymbolCandidate) => (r.exchange === 'Milan' ? 0 : r.currency === 'EUR' ? 1 : 2);
  return [...groups.values()].map((g) => [...g].sort((a, b) => rank(a) - rank(b)));
}

export default function Home() {
  const router = useRouter();
  const profile = useInvestorProfile();
  const recent = useRecentReports();
  const [q, setQ] = useState(lastSearch?.q ?? '');
  const [state, setState] = useState<State>(lastSearch?.state ?? { status: 'idle' });
  const [welcome, setWelcome] = useState(() => flash.welcome);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile === null) router.replace('/profilo');
  }, [profile, router]);

  useEffect(() => {
    if (!welcome) return;
    flash.welcome = false;
    inputRef.current?.focus();
  }, [welcome]);

  useEffect(() => {
    lastSearch = { q, state };
  }, [q, state]);

  if (!profile) return <PageLoading />;

  async function run(raw: string) {
    const query = raw.trim();
    if (!query) {
      inputRef.current?.focus();
      return;
    }
    setWelcome(false);
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok) setState({ status: 'error', message: json.error ?? FALLBACK_ERR });
      else setState({ status: 'done', query, results: json.results });
    } catch {
      setState({ status: 'error', message: FALLBACK_ERR });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    inputRef.current?.blur(); // close the mobile keyboard to reveal results
    void run(q);
  }

  function pick(example: string) {
    setQ(example);
    void run(example);
  }

  const showStart = state.status === 'idle';

  return (
    <div className="mx-auto max-w-2xl">
      {welcome && (
        <Callout tone="good" role="status" className="rise mb-5 rounded-2xl p-4">
          <p>
            <strong className="font-semibold text-success">Profilo pronto.</strong> Ora cerca lo strumento che vuoi analizzare. Il profilo si modifica in ogni momento da{' '}
            <Link href="/profilo" className="font-medium text-accent underline underline-offset-2">
              Profilo
            </Link>
            .
          </p>
        </Callout>
      )}

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cerca uno strumento</h1>
      <p className="mt-1 text-muted">ETF, fondi o azioni: scrivi ISIN, ticker o nome.</p>

      <form onSubmit={submit} role="search" className="mt-5 flex gap-2">
        <label htmlFor="q" className="sr-only">
          ISIN, ticker o nome
        </label>
        <div className="flex min-h-12 flex-1 items-center rounded-xl border border-line-strong/60 bg-surface pl-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted">
            <path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.6-1.9L20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            id="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={40}
            placeholder="Es. IE00BK5BQT80, AAPL"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="search"
            className="h-12 w-full min-w-0 bg-transparent px-2 text-base placeholder:text-muted/60 [&::-webkit-search-cancel-button]:hidden"
            style={{ outline: 'none' }}
          />
          {q && (
            <button
              type="button"
              aria-label="Cancella ricerca"
              onClick={() => {
                setQ('');
                setState({ status: 'idle' });
                inputRef.current?.focus();
              }}
              className="pressable mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <Button type="submit" loading={state.status === 'loading'} className="px-4 sm:px-6">
          Cerca
        </Button>
      </form>

      <div aria-live="polite" className="mt-6">
        {state.status === 'loading' && (
          <div role="status" aria-label="Ricerca in corso" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <div className="card rise rounded-2xl border border-line border-l-4 border-l-error bg-surface p-4">
            <p className="flex items-start gap-2 font-medium">
              <ToneIcon tone="bad" className="mt-0.5 h-5 w-5 text-error" />
              {state.message}
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => run(q)}>
              Riprova
            </Button>
          </div>
        )}

        {state.status === 'done' && state.results.length === 0 && (
          <div className="card rise rounded-2xl border border-line border-l-4 border-l-warn bg-surface p-5">
            <p className="flex items-start gap-2 font-semibold">
              <ToneIcon tone="worry" className="mt-0.5 h-5 w-5 text-warn" />
              Nessun risultato per “{state.query}”
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Controlla l&apos;ISIN: sono 12 caratteri, es. IE00BK5BQT80.</li>
              <li>Prova con il ticker (es. AAPL) o con una parte del nome.</li>
              <li>Fondi comuni e obbligazioni singole non sono supportati.</li>
            </ul>
            <Examples onPick={pick} />
          </div>
        )}

        {state.status === 'done' && state.results.length > 0 && <Results results={state.results} />}
      </div>

      {showStart && (
        <div className="space-y-8">
          {recent.length > 0 && (
            <section aria-labelledby="h-recent">
              <div className="flex items-center justify-between">
                <h2 id="h-recent" className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Visti di recente
                </h2>
                <button
                  type="button"
                  onClick={clearRecentReports}
                  className="pressable -mr-2 min-h-11 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  Cancella
                </button>
              </div>
              <ul className="card mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {recent.map((r) => (
                  <li key={r.symbol}>
                    <Link href={`/report/${encodeURIComponent(r.symbol)}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <TypeBadge type={r.type} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block font-medium leading-snug">{r.name}</span>
                        <span className="block text-sm text-muted">
                          {r.symbol} · {typeLabel(r.type)}
                        </span>
                      </span>
                      <Chevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recent.length > 0 && (
            <section aria-labelledby="h-ex2">
              <h2 id="h-ex2" className="text-sm font-semibold uppercase tracking-wide text-muted">
                Esempi di ricerca
              </h2>
              <Examples onPick={pick} compact />
            </section>
          )}
          {recent.length === 0 && (
            <section aria-labelledby="h-ex" className="rounded-2xl border border-dashed border-accent/30 bg-accent-soft/40 p-5">
              <h2 id="h-ex" className="font-semibold">
                Non sai da dove iniziare?
              </h2>
              <p className="mt-1 text-sm text-muted">
                L&apos;ISIN lo trovi nella scheda dello strumento sul sito della tua banca o del tuo broker. Oppure prova un esempio:
              </p>
              <Examples onPick={pick} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Examples({ onPick, compact }: { onPick: (q: string) => void; compact?: boolean }) {
  return (
    <div className={cx('flex flex-wrap gap-2', compact ? 'mt-2' : 'mt-4')}>
      {EXAMPLES.map((e) => (
        <button
          key={e.q}
          type="button"
          onClick={() => onPick(e.q)}
          className="pressable inline-flex min-h-11 flex-col items-start justify-center rounded-xl border border-accent/25 bg-surface px-3 py-1.5 text-left hover:border-accent/60 hover:bg-accent-soft"
        >
          <span className="text-sm font-semibold text-accent">{e.label}</span>
          <span className="text-xs text-muted">{e.note}</span>
        </button>
      ))}
    </div>
  );
}

const BADGES: Record<InstrumentType, { text: string; className: string }> = {
  ETF: { text: 'ETF', className: 'bg-accent-soft text-accent' },
  FUND: {
    text: 'FON',
    className: 'bg-[color-mix(in_srgb,var(--bar-6)_16%,transparent)] text-[color-mix(in_srgb,var(--bar-6)_70%,var(--text))]',
  },
  STOCK: {
    text: 'AZ',
    className: 'bg-[color-mix(in_srgb,var(--bar-2)_16%,transparent)] text-[color-mix(in_srgb,var(--bar-2)_70%,var(--text))]',
  },
};

function TypeBadge({ type }: { type: InstrumentType }) {
  const b = BADGES[type];
  return (
    <span
      aria-hidden="true"
      className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[0.6875rem] font-bold tracking-wide', b.className)}
    >
      {b.text}
    </span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted">
      <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Results({ results }: { results: SymbolCandidate[] }) {
  const groups = groupByName(results);
  return (
    <div className="rise">
      <p className="text-sm text-muted">{results.length === 1 ? '1 risultato' : `${results.length} risultati`}. Tocca per aprire il report.</p>
      <ul className="mt-3 space-y-3">
        {groups.map((g) => {
          const head = g[0];
          const tags = nameTags(head.name);
          return (
            <li key={`${head.name}|${head.type}`} className="card overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="px-4 pt-3">
                <p className="font-semibold leading-snug">{head.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Chip tone="accent">{typeLabel(head.type)}</Chip>
                  {tags.map((t) => (
                    <Chip key={t} tone={t === 'Strategia con opzioni' ? 'warn' : 'bad'}>
                      {t}
                    </Chip>
                  ))}
                </div>
                {g.length > 1 && (
                  <p className="mt-2 text-xs text-muted">Quotato su {g.length} borse: cambiano valuta e orari di negoziazione, non lo strumento.</p>
                )}
              </div>
              <ul className={cx('mt-2', g.length > 1 && 'divide-y divide-line border-t border-line')}>
                {g.map((r) => (
                  <li key={r.symbol}>
                    <Link
                      href={`/report/${encodeURIComponent(r.symbol)}`}
                      className="pressable flex min-h-13 items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {exchangeLabel(r.exchange) ?? 'Borsa non indicata'}
                          {r.currency && <span className="text-muted"> · {r.currency}</span>}
                        </span>
                        <span className="block text-sm text-muted">{r.symbol}</span>
                      </span>
                      <Chevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
