'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Report, Metrics } from '@/lib/report';
import type { InstrumentProfile } from '@/lib/data/types';
import { profileFit, STATUS_LABEL, NA, type Knowledge } from '@/lib/profileFit';
import { fmtBig, fmtDate, fmtNum, fmtPct } from '@/lib/format';
import { useBenchmarkPref, useInvestorProfile } from '@/lib/profileStore';
import { PriceChart } from './PriceChart';
import { AiSummary } from './AiSummary';

const DEFAULT_BENCHMARK = 'VWCE.DE';
const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;
const LEVEL_RANK: Record<Knowledge, number> = { base: 0, intermedio: 1, avanzato: 2 };

type Fetched = { key: string; report?: Report; error?: string };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-700">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function bestReturn(m: Metrics): { label: string; value?: number } {
  if (m.return5y !== undefined) return { label: 'Rendimento annualizzato 5 anni', value: m.return5y };
  if (m.return3y !== undefined) return { label: 'Rendimento annualizzato 3 anni (5 anni: Dato non disponibile)', value: m.return3y };
  if (m.return1y !== undefined) return { label: 'Rendimento annualizzato 1 anno (5 anni: Dato non disponibile)', value: m.return1y };
  return { label: 'Rendimento annualizzato 5 anni' };
}

export function ReportView({ symbol }: { symbol: string }) {
  const router = useRouter();
  const profile = useInvestorProfile();
  const [bench, setBench] = useBenchmarkPref(DEFAULT_BENCHMARK);
  const [benchInput, setBenchInput] = useState<string | null>(null);
  const [benchErr, setBenchErr] = useState<string>();
  const [levelOverride, setLevelOverride] = useState<Knowledge | null>(null);
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    if (profile === null) router.replace('/profilo');
  }, [profile, router]);

  const key = `${symbol}|${bench}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/report?symbol=${encodeURIComponent(symbol)}&benchmark=${encodeURIComponent(bench)}`)
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        setFetched(r.ok ? { key, report: j } : { key, error: j.error ?? 'Strumento non trovato o dati non disponibili' });
      })
      .catch(() => !cancelled && setFetched({ key, error: 'Strumento non trovato o dati non disponibili' }));
    return () => {
      cancelled = true;
    };
  }, [key, symbol, bench]);

  const report = fetched?.key === key ? fetched.report : undefined;
  const level: Knowledge = levelOverride ?? profile?.knowledge ?? 'base';
  const rank = LEVEL_RANK[level];

  const fit = useMemo(
    () =>
      report && profile
        ? profileFit(profile, {
            maxDrawdown: report.metrics.maxDrawdown?.value,
            volatility: report.metrics.volatility,
            currency: report.instrument.currency,
            monthly: report.monthly,
          })
        : [],
    [report, profile],
  );

  if (!profile) return <p role="status">Caricamento…</p>;

  const shownFit = fit;

  function submitBench(e: React.FormEvent) {
    e.preventDefault();
    const v = (benchInput ?? bench).trim().toUpperCase();
    if (!SYMBOL_RE.test(v)) {
      setBenchErr('Ticker non valido (massimo 20 caratteri: lettere, numeri, . - = ^).');
      return;
    }
    setBenchErr(undefined);
    setBench(v);
    setBenchInput(null);
  }

  const picker = (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="level">Livello di dettaglio</label>
      <select
        id="level"
        value={level}
        onChange={(e) => setLevelOverride(e.target.value as Knowledge)}
        className="rounded border border-slate-500 bg-white px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
      >
        <option value="base">Base</option>
        <option value="intermedio">Intermedio</option>
        <option value="avanzato">Avanzato</option>
      </select>
      <Link href="/profilo" className="text-blue-800 underline">
        Modifica profilo
      </Link>
    </div>
  );

  if (!fetched || fetched.key !== key) {
    return (
      <div>
        {picker}
        <p role="status" className="mt-6">
          Caricamento del report…
        </p>
      </div>
    );
  }
  if (!report) {
    return (
      <div>
        <p role="alert" className="mt-6 font-medium">
          {fetched.error}
        </p>
        <p className="mt-2">
          <Link href="/" className="text-blue-800 underline">
            Torna alla ricerca
          </Link>
        </p>
      </div>
    );
  }

  const { instrument: ins, metrics: m } = report;
  const benchOk = 'profile' in report.benchmark ? report.benchmark : undefined;
  const best = bestReturn(m);
  const dd = m.maxDrawdown;
  const typeLabel = ins.type === 'ETF' ? 'ETF' : 'Azione';

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold">{ins.name}</h1>
        <p className="mt-1 text-slate-700">
          {ins.symbol} · {typeLabel} · {ins.currency || NA} · {ins.exchange || NA}
          {ins.isin ? ` · ISIN ${ins.isin}` : ''}
        </p>
        {picker}
      </header>

      <Section id="h-costi" title="Costi">
        {ins.type === 'ETF' ? (
          <Dl rows={[['TER (spese correnti annue)', fmtPct(ins.ter, 2)]]} />
        ) : (
          <p>Il TER si applica agli ETF: non è previsto per le azioni.</p>
        )}
      </Section>

      <Section id="h-perf" title="Performance e rischio">
        <Dl
          rows={
            rank === 0
              ? [
                  [best.label, fmtPct(best.value)],
                  ['Drawdown massimo storico', fmtPct(dd?.value)],
                ]
              : [
                  ['Rendimento annualizzato 1 anno', fmtPct(m.return1y)],
                  ['Rendimento annualizzato 3 anni', fmtPct(m.return3y)],
                  ['Rendimento annualizzato 5 anni', fmtPct(m.return5y)],
                  [`Volatilità annua${m.volatilityYears ? ` (ultimi ${fmtNum(m.volatilityYears)} anni)` : ''}`, fmtPct(m.volatility)],
                  ['Drawdown massimo storico', fmtPct(dd?.value)],
                  ...(rank >= 2
                    ? ([
                        ['Drawdown: massimo precedente', fmtDate(dd?.peakDate)],
                        ['Drawdown: minimo', fmtDate(dd?.troughDate)],
                        ['Storico disponibile', m.historyStart ? `${fmtDate(m.historyStart)} – ${fmtDate(m.historyEnd)}` : NA],
                      ] as [string, ReactNode][])
                    : []),
                ]
          }
        />
      </Section>

      <Section id="h-bench" title="Confronto con il benchmark">
        <form onSubmit={submitBench} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="bench" className="block text-sm font-medium">
              Ticker del benchmark
            </label>
            <input
              id="bench"
              value={benchInput ?? bench}
              onChange={(e) => setBenchInput(e.target.value)}
              maxLength={20}
              aria-invalid={benchErr ? true : undefined}
              aria-describedby={benchErr ? 'bench-err' : undefined}
              className="mt-1 rounded border border-slate-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-blue-800 px-4 py-2 font-medium text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Applica
          </button>
        </form>
        {benchErr && (
          <p id="bench-err" className="mt-1 text-sm font-medium">
            {benchErr}
          </p>
        )}
        {!benchOk ? (
          <p className="mt-3">
            Benchmark {bench}: {'error' in report.benchmark ? report.benchmark.error : NA}
          </p>
        ) : (
          <>
            {rank >= 1 && <BenchTable a={ins} am={m} b={benchOk.profile} bm={benchOk.metrics} />}
            {report.chart.length > 0 ? (
              <PriceChart data={report.chart} nameA={ins.symbol} nameB={benchOk.profile.symbol} />
            ) : (
              <p className="mt-3">Grafico: {NA}</p>
            )}
          </>
        )}
      </Section>

      {(ins.holdings || ins.sectors || ins.countries || ins.sector || ins.country) && rank >= 1 && (
        <Section id="h-comp" title="Composizione">
          <Composition ins={ins} full={rank >= 2} />
        </Section>
      )}

      {ins.type === 'STOCK' && rank >= 1 && (
        <Section id="h-fond" title="Fondamentali (ultimo esercizio annuale)">
          {ins.fundamentals ? (
            <>
              <Dl
                rows={[
                  ['Ricavi', fmtBig(ins.fundamentals.revenue, ins.fundamentals.currency)],
                  ['Utile netto', fmtBig(ins.fundamentals.netIncome, ins.fundamentals.currency)],
                  ['Debito totale', fmtBig(ins.fundamentals.totalDebt, ins.fundamentals.currency)],
                  ['Free cash flow', fmtBig(ins.fundamentals.freeCashFlow, ins.fundamentals.currency)],
                  ['Esercizio', ins.fundamentals.fiscalYear ?? NA],
                  ['Valuta dei bilanci', ins.fundamentals.currency ?? NA],
                ]}
              />
            </>
          ) : (
            <p>{NA}</p>
          )}
        </Section>
      )}

      <Section id="h-fit" title="Confronto con il tuo profilo">
        <ul className="space-y-3">
          {shownFit.map((f) => (
            <li key={f.id} className="rounded border border-slate-300 p-3">
              {f.status !== 'info' && (
                <span className="mb-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                  {STATUS_LABEL[f.status]}
                </span>
              )}
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      {rank >= 2 && report.notes.length > 0 && (
        <Section id="h-note" title="Note">
          <ul className="list-disc pl-5">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      )}

      <AiSummary report={report} fit={shownFit} level={level} />
    </div>
  );
}

function BenchTable({ a, am, b, bm }: { a: InstrumentProfile; am: Metrics; b: InstrumentProfile; bm: Metrics }) {
  const rows: [string, string, string][] = [
    ['Rendimento annualizzato 1 anno', fmtPct(am.return1y), fmtPct(bm.return1y)],
    ['Rendimento annualizzato 3 anni', fmtPct(am.return3y), fmtPct(bm.return3y)],
    ['Rendimento annualizzato 5 anni', fmtPct(am.return5y), fmtPct(bm.return5y)],
    ['Volatilità annua', fmtPct(am.volatility), fmtPct(bm.volatility)],
    ['Drawdown massimo storico', fmtPct(am.maxDrawdown?.value), fmtPct(bm.maxDrawdown?.value)],
  ];
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[420px] text-left">
        <caption className="sr-only">Confronto tra strumento e benchmark</caption>
        <thead>
          <tr className="border-b border-slate-400">
            <th scope="col" className="py-2 pr-2 font-medium">
              Indicatore
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              {a.symbol}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {b.symbol}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, x, y]) => (
            <tr key={k} className="border-b border-slate-200">
              <th scope="row" className="py-2 pr-2 font-normal text-slate-700">
                {k}
              </th>
              <td className="py-2 pr-2 text-right tabular-nums">{x}</td>
              <td className="py-2 text-right tabular-nums">{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Composition({ ins, full }: { ins: InstrumentProfile; full: boolean }) {
  const holdings = ins.holdings ? (full ? ins.holdings : ins.holdings.slice(0, 5)) : undefined;
  const sectors = ins.sectors ? (full ? ins.sectors : ins.sectors.slice(0, 5)) : undefined;
  return (
    <div className="space-y-4">
      {holdings && (
        <div>
          <h3 className="font-medium">{full ? 'Principali posizioni' : 'Prime posizioni'}</h3>
          <ul className="mt-1">
            {holdings.map((h) => (
              <li key={`${h.symbol}-${h.name}`} className="flex justify-between gap-4 border-b border-slate-200 py-1">
                <span>{h.name}</span>
                <span className="tabular-nums">{fmtPct(h.weight)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sectors && (
        <div>
          <h3 className="font-medium">Settori</h3>
          <ul className="mt-1">
            {sectors.map((s) => (
              <li key={s.name} className="flex justify-between gap-4 border-b border-slate-200 py-1">
                <span>{s.name}</span>
                <span className="tabular-nums">{fmtPct(s.weight)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {ins.sector && <p>Settore dell&apos;azienda: {ins.sector}</p>}
      {full && ins.countries && (
        <div>
          <h3 className="font-medium">Paesi</h3>
          <ul className="mt-1">
            {ins.countries.map((c) => (
              <li key={c.name} className="flex justify-between gap-4 border-b border-slate-200 py-1">
                <span>{c.name}</span>
                <span className="tabular-nums">{fmtPct(c.weight)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {full && ins.country && <p>Paese dell&apos;azienda: {ins.country}</p>}
      {full && ins.type === 'ETF' && !ins.countries && <p>Ripartizione per paese: {NA}</p>}
    </div>
  );
}
