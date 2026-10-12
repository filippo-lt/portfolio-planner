'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Report, Metrics } from '@/lib/report';
import type { InstrumentProfile } from '@/lib/data/types';
import { profileFit, STATUS_LABEL, NA, type Knowledge } from '@/lib/profileFit';
import { fmtBig, fmtDate, fmtNum, fmtPct } from '@/lib/format';
import { clearBenchmarkPref, pushRecentReport, useBenchmarkPref, useInvestorProfile } from '@/lib/profileStore';
import { countryLabel, exchangeLabel, nameTags, sectorLabel } from '@/lib/labels';
import { PriceChart } from './PriceChart';
import { AiSummary } from './AiSummary';
import { BackLink, Button, ButtonLink, Card, Chip, InfoTip, SegmentedControl, Skeleton, Spinner, cx } from './ui';

const DEFAULT_BENCHMARK = 'VWCE.DE';
const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;
const LEVEL_RANK: Record<Knowledge, number> = { base: 0, intermedio: 1, avanzato: 2 };
const FALLBACK_ERR = 'Strumento non trovato o dati non disponibili';

const PRESETS = [
  { symbol: 'VWCE.DE', label: 'Azioni mondo', detail: 'FTSE All-World' },
  { symbol: 'SWDA.MI', label: 'Azioni paesi sviluppati', detail: 'MSCI World' },
  { symbol: 'SXR8.DE', label: 'Azioni USA', detail: 'S&P 500' },
  { symbol: 'AGGH.MI', label: 'Obbligazioni globali', detail: 'Global Aggregate' },
];

const TERMS = {
  ret: 'Guadagno o perdita medio per anno nel periodo, calcolato come se fosse stato uguale ogni anno.',
  dd: 'La discesa più ampia registrata dal valore più alto al minimo successivo. In inglese “drawdown massimo”.',
  vol: 'Quanto oscilla il prezzo nel corso di un anno. Più è alta, più ampi sono i movimenti in su e in giù.',
  bench: "Uno strumento di riferimento con cui confrontare l'andamento. Puoi sceglierne uno diverso.",
};

type Fetched = { key: string; symbol: string; report?: Report; error?: string };

function Section({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="card divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted">{k}</dt>
          <dd className={cx('text-right font-medium tabular-nums', v === NA && 'text-sm font-normal text-muted')}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function bestReturn(m: Metrics): { label: string; value?: number; note?: string } {
  if (m.return5y !== undefined) return { label: 'Rendimento annuo, 5 anni', value: m.return5y };
  if (m.return3y !== undefined) return { label: 'Rendimento annuo, 3 anni', value: m.return3y, note: '5 anni: dato non disponibile' };
  if (m.return1y !== undefined) return { label: 'Rendimento annuo, 1 anno', value: m.return1y, note: '5 anni: dato non disponibile' };
  return { label: 'Rendimento annuo, 5 anni' };
}

function Figure({ label, value, tip, note }: { label: string; value: string; tip?: ReactNode; note?: string }) {
  const na = !/\d/.test(value);
  return (
    <div className="card flex flex-col rounded-2xl border border-line bg-surface p-3.5">
      <dt className="flex items-start justify-between gap-1 text-sm leading-snug text-muted">
        <span className="pt-0.5">{label}</span>
        {tip && (
          <span className="-mr-1.5 -mt-1 shrink-0">
            <InfoTip term={label}>{tip}</InfoTip>
          </span>
        )}
      </dt>
      <dd className={cx('mt-auto pt-1 tabular-nums', na ? 'text-base font-medium text-muted' : 'text-[1.75rem] font-semibold leading-tight tracking-tight')}>
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-xs text-muted">{note}</dd>}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div role="status" aria-label="Caricamento del report" className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <p className="text-center text-sm text-muted">Raccolgo prezzi e dati dello strumento…</p>
    </div>
  );
}

export function ReportView({ symbol }: { symbol: string }) {
  const router = useRouter();
  const profile = useInvestorProfile();
  const [bench, setBench] = useBenchmarkPref(DEFAULT_BENCHMARK);
  const [custom, setCustom] = useState('');
  const [benchMsg, setBenchMsg] = useState<string>();
  const [levelOverride, setLevelOverride] = useState<Knowledge | null>(null);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const lastGood = useRef<string | null>(null);

  useEffect(() => {
    if (profile === null) router.replace('/profilo');
  }, [profile, router]);

  const key = `${symbol}|${bench}|${reloadTick}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/report?symbol=${encodeURIComponent(symbol)}&benchmark=${encodeURIComponent(bench)}`)
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setFetched({ key, symbol, error: j.error ?? FALLBACK_ERR });
          return;
        }
        const rep = j as Report;
        if ('error' in rep.benchmark) {
          // Never leave the user with a broken comparison: fall back to the last working benchmark.
          const fallback = lastGood.current ?? (bench !== DEFAULT_BENCHMARK ? DEFAULT_BENCHMARK : null);
          if (fallback && fallback !== bench) {
            setBenchMsg(`${bench}: dati non trovati. Il confronto resta con ${fallback}.`);
            if (fallback === DEFAULT_BENCHMARK) clearBenchmarkPref();
            else setBench(fallback);
            return;
          }
        } else {
          lastGood.current = bench;
        }
        setFetched({ key, symbol, report: rep });
      })
      .catch(() => !cancelled && setFetched({ key, symbol, error: FALLBACK_ERR }));
    return () => {
      cancelled = true;
    };
  }, [key, symbol, bench, setBench]);

  // Keep showing the current report while only the benchmark changes.
  const report = fetched?.symbol === symbol ? fetched.report : undefined;
  const refreshing = !!report && fetched?.key !== key;
  const level: Knowledge = levelOverride ?? profile?.knowledge ?? 'base';
  const rank = LEVEL_RANK[level];

  const ins = report?.instrument;
  useEffect(() => {
    if (ins) pushRecentReport({ symbol, name: ins.name, type: ins.type });
  }, [ins, symbol]);

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

  if (!profile) return <ReportSkeleton />;

  function chooseBench(v: string) {
    setBenchMsg(undefined);
    if (PRESETS.some((p) => p.symbol === v)) setCustom('');
    if (v === DEFAULT_BENCHMARK) clearBenchmarkPref();
    else setBench(v);
  }

  function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const v = custom.trim().toUpperCase();
    if (!SYMBOL_RE.test(v)) {
      setBenchMsg('Ticker non valido: usa lettere, numeri e . - = ^ (massimo 20 caratteri).');
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur();
    chooseBench(v);
  }

  const back = (
    <div className="-mt-2 mb-2">
      <BackLink href="/">Cerca</BackLink>
    </div>
  );

  if (!fetched || fetched.symbol !== symbol || (!report && fetched.key !== key)) {
    return (
      <div>
        {back}
        <ReportSkeleton />
      </div>
    );
  }
  if (!report || !ins) {
    return (
      <div>
        {back}
        <Card className="rise mt-2">
          <h1 className="text-lg font-semibold">Report non disponibile</h1>
          <p role="alert" className="mt-1 text-muted">
            {fetched.error}. Può capitare con strumenti poco scambiati o quando la fonte dati non risponde.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => setReloadTick((t) => t + 1)}>Riprova</Button>
            <ButtonLink href="/" variant="secondary">
              Nuova ricerca
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const m = report.metrics;
  const benchOk = 'profile' in report.benchmark ? report.benchmark : undefined;
  const sameAsBench = !!benchOk && benchOk.profile.symbol.toUpperCase() === ins.symbol.toUpperCase();
  const sameFund = !!benchOk && !sameAsBench && benchOk.profile.name === ins.name;
  const best = bestReturn(m);
  const dd = m.maxDrawdown;
  const isEtf = ins.type === 'ETF';
  const benchPreset = PRESETS.find((p) => p.symbol === bench);
  const ddTol = -Math.abs(profile.maxDrawdownPct);

  const figures = [
    <Figure key="ret" label={best.label} value={fmtPct(best.value)} note={best.note} tip={TERMS.ret} />,
    <Figure key="dd" label="Perdita massima" value={fmtPct(dd?.value)} note={`La tua soglia: ${fmtNum(ddTol, 0)}%`} tip={TERMS.dd} />,
    ...(rank >= 1 ? [<Figure key="vol" label="Volatilità annua" value={fmtPct(m.volatility)} tip={TERMS.vol} />] : []),
    ...(!isEtf
      ? [<Figure key="ter" label="Costo annuo (TER)" value="Non previsto" note="Il TER si applica ai fondi e agli ETF, non alle azioni." />]
      : [
          <Figure
            key="ter"
            label="Costo annuo (TER)"
            value={fmtPct(ins.ter, 2)}
            tip={
              ins.ter !== undefined
                ? `Spese correnti del fondo, già incluse nel prezzo. Con TER ${fmtPct(ins.ter, 2)}: circa ${fmtNum(ins.ter * 10000, 0)} € l'anno ogni 10.000 € investiti.`
                : 'Spese correnti del fondo, già incluse nel prezzo.'
            }
          />,
        ]),
  ];

  return (
    <div className="rise">
      {back}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-x-10">
        <div className="lg:col-start-1">
          <header>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{ins.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="accent">{isEtf ? 'ETF' : 'Azione'}</Chip>
              {ins.currency && <Chip>{ins.currency}</Chip>}
              {ins.exchange && <Chip>{exchangeLabel(ins.exchange)}</Chip>}
              {ins.sector && <Chip>{sectorLabel(ins.sector)}</Chip>}
              {nameTags(ins.name).map((t) => (
                <Chip key={t} tone="warn">
                  {t}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">
              {ins.symbol}
              {ins.isin ? ` · ISIN ${ins.isin}` : ''}
              {m.historyEnd ? ` · dati al ${fmtDate(m.historyEnd)}` : ''}
            </p>
          </header>

          <div className="mt-5">
            <SegmentedControl
              label="Livello di dettaglio"
              value={level}
              onChange={(v) => {
                setLevelOverride(v);
                setBenchMsg(undefined);
              }}
              options={[
                { value: 'base', label: 'Base' },
                { value: 'intermedio', label: 'Intermedio' },
                { value: 'avanzato', label: 'Avanzato' },
              ]}
            />
            {levelOverride && levelOverride !== profile.knowledge && (
              <p className="mt-1.5 text-xs text-muted">Solo per questa pagina. Il livello predefinito si cambia dal Profilo.</p>
            )}
          </div>

          <dl className={cx('mt-4 grid grid-cols-2 gap-2', figures.length === 4 ? 'sm:grid-cols-4 lg:grid-cols-2' : 'sm:grid-cols-3 lg:grid-cols-2 max-sm:[&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-2')}>
            {figures}
          </dl>

          <AiSummary report={report} fit={fit} level={level} />
        </div>

        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:[&_section]:mt-0">
          <div className="lg:sticky lg:top-20">
            <Section
              id="h-fit"
              title="Rispetto al tuo profilo"
              aside={
                <Link
                  href="/profilo"
                  className="pressable -mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  Modifica profilo
                </Link>
              }
            >
              <p className="-mt-1 mb-3 text-sm text-muted">
                Soglia di perdita {fmtNum(profile.maxDrawdownPct, 0)}% · orizzonte {profile.horizonYears} {profile.horizonYears === 1 ? 'anno' : 'anni'}
              </p>
              <ul className="space-y-2">
                {fit.map((f) => (
                  <li key={f.id} className={cx('card rounded-2xl border border-line bg-surface p-4', f.status === 'oltre' && 'border-l-[3px] border-l-warn')}>
                    {f.status !== 'info' && (
                      <div className="mb-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
                          <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', f.status === 'oltre' ? 'bg-warn' : 'bg-muted')} />
                          {STATUS_LABEL[f.status].replace(/^./, (c) => c.toUpperCase())}
                        </span>
                      </div>
                    )}
                    <p className="text-[0.9375rem] leading-6">{f.text}</p>
                  </li>
                ))}
              </ul>
              {fit.some((f) => f.id === 'rolling') && (
                <details className="mt-2 rounded-xl px-1 text-sm">
                  <summary className="pressable inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 font-medium text-accent hover:bg-accent-soft">
                    Cosa sono le finestre mobili?
                  </summary>
                  <p className="mt-1 px-2 text-muted">
                    Si prendono tutti i periodi di durata pari al tuo orizzonte presenti nello storico (uno per ogni mese di partenza) e si calcola il
                    rendimento annuo di ciascuno. Il risultato mostra il periodo peggiore e quello migliore.
                  </p>
                </details>
              )}
            </Section>
          </div>
        </aside>

        <div className="lg:col-start-1">
          {rank >= 1 && (!benchOk || sameAsBench || rank >= 2) && (
            <Section id="h-perf" title={rank >= 2 ? 'Dettagli di calcolo' : 'Rendimenti per periodo'}>
              <Rows
                rows={[
                  // With a working comparison, returns per period are already in the comparison table.
                  ...((!benchOk || sameAsBench
                    ? [
                        ['Rendimento annuo, 1 anno', fmtPct(m.return1y)],
                        ['Rendimento annuo, 3 anni', fmtPct(m.return3y)],
                        ['Rendimento annuo, 5 anni', fmtPct(m.return5y)],
                      ]
                    : []) as [string, ReactNode][]),
                  ...(rank >= 2 && m.volatilityYears
                    ? ([['Volatilità annua calcolata su', `ultimi ${fmtNum(m.volatilityYears)} anni`]] as [string, ReactNode][])
                    : []),
                  ...(rank >= 2
                    ? ([
                        ['Inizio della perdita (massimo)', fmtDate(dd?.peakDate)],
                        ['Fine della perdita (minimo)', fmtDate(dd?.troughDate)],
                        ['Storico disponibile', m.historyStart ? `${fmtDate(m.historyStart)} – ${fmtDate(m.historyEnd)}` : NA],
                      ] as [string, ReactNode][])
                    : []),
                ]}
              />
            </Section>
          )}

          <Section id="h-bench" title="Confronto con un riferimento" aside={refreshing ? <Spinner className="h-5 w-5 text-muted" /> : undefined}>
            <p className="-mt-1 text-sm text-muted">{TERMS.bench}</p>
            <div role="radiogroup" aria-label="Riferimento" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const on = p.symbol === bench;
                return (
                  <button
                    key={p.symbol}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => chooseBench(p.symbol)}
                    className={cx(
                      'pressable flex min-h-14 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left',
                      on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <span className={cx('text-sm font-semibold', on && 'text-accent')}>{p.label}</span>
                    <span className="text-xs text-muted">{p.detail}</span>
                  </button>
                );
              })}
              {!benchPreset && (
                <span
                  role="radio"
                  aria-checked="true"
                  className="col-span-2 flex min-h-14 flex-col items-start justify-center rounded-xl border border-accent bg-accent-soft px-3 py-2 sm:col-span-4"
                >
                  <span className="text-sm font-semibold text-accent">Personalizzato</span>
                  <span className="text-xs text-muted">{bench}</span>
                </span>
              )}
            </div>
            <form onSubmit={submitCustom} className="mt-2 flex gap-2">
              <label htmlFor="bench" className="sr-only">
                Altro ticker di riferimento
              </label>
              <input
                id="bench"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={20}
                placeholder="Altro ticker, es. CSPX.L"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                aria-describedby={benchMsg ? 'bench-msg' : undefined}
                className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong/60 bg-surface px-3 text-base focus:border-accent"
              />
              <Button type="submit" variant="secondary" className="min-h-11 px-4 text-sm" disabled={!custom.trim()}>
                Confronta
              </Button>
            </form>
            {benchMsg && (
              <p id="bench-msg" role="status" className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm">
                {benchMsg}
              </p>
            )}

            <div className={cx('transition-opacity', refreshing && 'opacity-50')}>
              {!benchOk ? (
                <p className="mt-4 text-muted">
                  Riferimento {bench}: {'error' in report.benchmark ? report.benchmark.error : NA}
                </p>
              ) : sameAsBench ? (
                <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm">
                  Lo strumento coincide con il riferimento scelto: seleziona un altro riferimento per vedere un confronto.
                </p>
              ) : (
                <>
                  {sameFund && (
                    <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm">
                      Il riferimento scelto è lo stesso strumento quotato su un&apos;altra borsa: i valori sono quasi identici.
                    </p>
                  )}
                  {rank >= 1 && <BenchCompare a={ins} am={m} b={benchOk.profile} bm={benchOk.metrics} />}
                  {report.chart.length > 0 ? (
                    <PriceChart data={report.chart} nameA={ins.symbol} nameB={benchOk.profile.symbol} />
                  ) : (
                    <p className="mt-4 text-muted">Grafico: {NA}</p>
                  )}
                </>
              )}
            </div>
          </Section>

          {(ins.holdings || ins.sectors || ins.countries || (rank >= 2 && (ins.country || ins.type === 'ETF'))) && rank >= 1 && (
            <Section id="h-comp" title="Composizione">
              <Composition ins={ins} full={rank >= 2} />
            </Section>
          )}

          {ins.type === 'STOCK' && rank >= 1 && (
            <Section id="h-fond" title="Bilancio (ultimo esercizio)">
              {ins.fundamentals ? (
                <Rows
                  rows={[
                    ['Ricavi', fmtBig(ins.fundamentals.revenue, ins.fundamentals.currency)],
                    ['Utile netto', fmtBig(ins.fundamentals.netIncome, ins.fundamentals.currency)],
                    ['Debito totale', fmtBig(ins.fundamentals.totalDebt, ins.fundamentals.currency)],
                    ['Free cash flow', fmtBig(ins.fundamentals.freeCashFlow, ins.fundamentals.currency)],
                    ['Esercizio', ins.fundamentals.fiscalYear ?? NA],
                  ]}
                />
              ) : (
                <p className="text-muted">{NA}</p>
              )}
            </Section>
          )}

          {rank >= 2 && report.notes.length > 0 && (
            <Section id="h-note" title="Note di calcolo">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {report.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Section>
          )}

          {rank < 2 && (
            <p className="mt-8 text-sm text-muted">
              Vuoi più dati? Passa {rank === 0 ? 'a' : 'ad'}{' '}
              <button
                type="button"
                onClick={() => setLevelOverride(rank === 0 ? 'intermedio' : 'avanzato')}
                className="font-medium text-accent underline underline-offset-2"
              >
                {rank === 0 ? 'Intermedio' : 'Avanzato'}
              </button>
              .
            </p>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <ButtonLink href="/" variant="secondary" block>
              Analizza un altro strumento
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenchCompare({ a, am, b, bm }: { a: InstrumentProfile; am: Metrics; b: InstrumentProfile; bm: Metrics }) {
  const rows: [string, string, string][] = [
    ['Rendimento annuo, 1 anno', fmtPct(am.return1y), fmtPct(bm.return1y)],
    ['Rendimento annuo, 3 anni', fmtPct(am.return3y), fmtPct(bm.return3y)],
    ['Rendimento annuo, 5 anni', fmtPct(am.return5y), fmtPct(bm.return5y)],
    ['Volatilità annua', fmtPct(am.volatility), fmtPct(bm.volatility)],
    ['Perdita massima storica', fmtPct(am.maxDrawdown?.value), fmtPct(bm.maxDrawdown?.value)],
  ];
  return (
    <table className="card mt-4 w-full table-fixed overflow-hidden rounded-2xl border border-line bg-surface text-left">
      <caption className="sr-only">
        Confronto tra {a.symbol} e {b.symbol}
      </caption>
      <colgroup>
        <col />
        <col className="w-[27%]" />
        <col className="w-[27%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="px-4 py-2.5 text-sm font-medium text-muted">
            <span className="sr-only">Indicatore</span>
          </th>
          <th scope="col" className="py-2.5 pr-3 text-right text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--chart-a)]" />
              <span className="truncate">{a.symbol}</span>
            </span>
          </th>
          <th scope="col" className="py-2.5 pr-4 text-right text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-3 rounded bg-[var(--chart-b)]" />
              <span className="truncate">{b.symbol}</span>
            </span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(([k, x, y]) => (
          <tr key={k}>
            <th scope="row" className="px-4 py-2.5 text-sm font-normal text-muted">
              {k}
            </th>
            <td className={cx('py-2.5 pr-3 text-right tabular-nums', x === NA ? 'text-xs text-muted' : 'font-medium')}>{x === NA ? 'n.d.' : x}</td>
            <td className={cx('py-2.5 pr-4 text-right tabular-nums', y === NA ? 'text-xs text-muted' : 'font-medium')}>{y === NA ? 'n.d.' : y}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AllocList({ title, items }: { title: string; items: { key: string; name: string; weight: number }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="mt-2 space-y-2.5">
        {items.map((h) => (
          <li key={h.key}>
            <div className="flex justify-between gap-4 text-sm">
              <span className="min-w-0 truncate">{h.name}</span>
              <span className="font-medium tabular-nums">{fmtPct(h.weight)}</span>
            </div>
            <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.min(h.weight, 1) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Composition({ ins, full }: { ins: InstrumentProfile; full: boolean }) {
  const holdings = ins.holdings ? (full ? ins.holdings : ins.holdings.slice(0, 5)) : undefined;
  const sectors = ins.sectors ? (full ? ins.sectors : ins.sectors.slice(0, 5)) : undefined;
  const facts: [string, string][] = [];
  if (full && ins.country) facts.push(['Paese', countryLabel(ins.country)]);
  if (full && ins.type === 'ETF' && !ins.countries) facts.push(['Ripartizione per paese', NA]);
  return (
    <div className="space-y-4">
      {(holdings || sectors || (full && ins.countries)) && (
        <Card className="space-y-6">
          {holdings && (
            <AllocList
              title={full ? 'Principali posizioni' : 'Prime 5 posizioni'}
              items={holdings.map((h) => ({ key: `${h.symbol}-${h.name}`, name: h.name, weight: h.weight }))}
            />
          )}
          {sectors && <AllocList title="Settori" items={sectors.map((s) => ({ key: s.name, name: s.name, weight: s.weight }))} />}
          {full && ins.countries && (
            <AllocList title="Paesi" items={ins.countries.map((c) => ({ key: c.name, name: countryLabel(c.name), weight: c.weight }))} />
          )}
        </Card>
      )}
      {facts.length > 0 && <Rows rows={facts} />}
    </div>
  );
}
