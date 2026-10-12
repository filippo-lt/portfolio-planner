'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useInvestorProfile } from '@/lib/profileStore';
import type { SymbolCandidate } from '@/lib/data/types';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; results: SymbolCandidate[] };

export default function Home() {
  const router = useRouter();
  const profile = useInvestorProfile();
  const [q, setQ] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    if (profile === null) router.replace('/profilo');
  }, [profile, router]);

  if (!profile) return <p role="status">Caricamento…</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok) setState({ status: 'error', message: json.error ?? 'Strumento non trovato o dati non disponibili' });
      else setState({ status: 'done', results: json.results });
    } catch {
      setState({ status: 'error', message: 'Strumento non trovato o dati non disponibili' });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Analizza uno strumento</h1>
      <p className="mt-2 text-slate-700">Inserisci l&apos;ISIN o il ticker di un ETF o di un&apos;azione per vedere dati e confronti numerici.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row" role="search">
        <div className="flex-1">
          <label htmlFor="q" className="block text-sm font-medium">
            ISIN o ticker
          </label>
          <input
            id="q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={40}
            placeholder="Esempio: IE00BK5BQT80 oppure AAPL"
            autoComplete="off"
            className="mt-1 block w-full rounded border border-slate-500 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
          />
        </div>
        <button
          type="submit"
          className="self-end rounded bg-blue-800 px-4 py-2 font-medium text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Cerca
        </button>
      </form>

      <div aria-live="polite" className="mt-6">
        {state.status === 'loading' && <p>Ricerca in corso…</p>}
        {state.status === 'error' && <p className="font-medium">{state.message}</p>}
        {state.status === 'done' && state.results.length === 0 && <p>Nessun risultato. Controlla ISIN o ticker.</p>}
        {state.status === 'done' && state.results.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded border border-slate-300">
            {state.results.map((r) => (
              <li key={r.symbol}>
                <Link
                  href={`/report/${encodeURIComponent(r.symbol)}`}
                  className="block px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
                >
                  <span className="block font-medium">{r.name}</span>
                  <span className="block text-sm text-slate-700">
                    {r.symbol} · {r.exchange || 'Borsa: Dato non disponibile'} · {r.currency ?? 'Valuta: Dato non disponibile'} ·{' '}
                    {r.type === 'ETF' ? 'ETF' : 'Azione'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
