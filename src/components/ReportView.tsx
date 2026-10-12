'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Report, Metrics } from '@/lib/report';
import type { AssetClass, InstrumentProfile } from '@/lib/data/types';
import { benchmarksFor, defaultBenchmarkFor, findBenchmark } from '@/lib/benchmarks';
import { profileFit, NA, type FitStatement, type Knowledge } from '@/lib/profileFit';
import { drawdownTone, fitReading, volatilityTone, type Tone } from '@/lib/tone';
import { fmtBig, fmtDate, fmtNum, fmtPct } from '@/lib/format';
import { pushRecentReport, useBenchmarkPrefs, useFeeOverride, useInvestorProfile, useSimAmount } from '@/lib/profileStore';
import { countryLabel, exchangeLabel, nameTags, sectorLabel, typeLabel } from '@/lib/labels';
import { PriceChart } from './PriceChart';
import { CostBlock } from './CostBlock';
import { FeeRows } from './FeeRows';
import { effectiveFees } from '@/lib/fees';
import { EuroVerdict, chartSeries } from './EuroVerdict';
import { SimilarProducts } from './SimilarProducts';
import { AiSummary } from './AiSummary';
import {
  BackLink,
  Button,
  ButtonLink,
  Callout,
  Card,
  Chip,
  InfoTip,
  SegmentedControl,
  Skeleton,
  Spinner,
  TONE_TEXT,
  TonePill,
  ToneIcon,
  ToneText,
  cx,
  signTone,
  toneEdge,
  type HlRule,
} from './ui';

const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;
const LEVEL_RANK: Record<Knowledge, number> = { base: 0, intermedio: 1, avanzato: 2 };
const FALLBACK_ERR = 'Strumento non trovato o dati non disponibili';

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

/** Percentage colored by sign (returns): gains green, losses red. */
function SignedPct({ v, digits }: { v: number | undefined; digits?: number }) {
  const s = fmtPct(v, digits);
  if (s === NA) return <>{NA}</>;
  return <span className={TONE_TEXT[signTone(v)]}>{v !== undefined && v > 0 ? `+${s}` : s}</span>;
}

const signedPct = (v: number | undefined): ReactNode => (v === undefined || !Number.isFinite(v) ? NA : <SignedPct v={v} />);

function bestReturn(m: Metrics): { label: string; value?: number; note?: string } {
  if (m.return5y !== undefined) return { label: 'Rendimento annuo, 5 anni', value: m.return5y };
  if (m.return3y !== undefined) return { label: 'Rendimento annuo, 3 anni', value: m.return3y, note: '5 anni: dato non disponibile' };
  if (m.return1y !== undefined) return { label: 'Rendimento annuo, 1 anno', value: m.return1y, note: '5 anni: dato non disponibile' };
  return { label: 'Rendimento annuo, 5 anni' };
}

function Figure({
  label,
  value,
  tip,
  note,
  tone = 'neutral',
  badge,
}: {
  label: string;
  value: string;
  tip?: ReactNode;
  note?: string;
  tone?: Tone;
  badge?: string;
}) {
  const na = !/\d/.test(value);
  return (
    <div className={cx('card flex flex-col rounded-2xl border border-line bg-surface p-3.5', !na && tone !== 'neutral' && 'border-t-4', !na && { good: 'border-t-success', worry: 'border-t-warn', bad: 'border-t-error', neutral: '' }[tone])}>
      <dt className="flex items-start justify-between gap-1 text-sm leading-snug text-muted">
        <span className="pt-0.5">{label}</span>
        {tip && (
          <span className="-mr-1.5 -mt-1 shrink-0">
            <InfoTip term={label}>{tip}</InfoTip>
          </span>
        )}
      </dt>
      <dd
        className={cx(
          'mt-auto pt-1 tabular-nums',
          na ? 'text-base font-medium text-muted' : cx('text-[1.75rem] font-semibold leading-tight tracking-tight', TONE_TEXT[tone]),
        )}
      >
        {value}
      </dd>
      {badge && !na && (
        <dd className="mt-1.5">
          <TonePill tone={tone}>{badge}</TonePill>
        </dd>
      )}
      {note && <dd className="mt-1 text-xs text-muted">{note}</dd>}
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
  const [benchPrefs, setBenchPref, clearBenchPref] = useBenchmarkPrefs();
  const [userFees, setUserFees] = useFeeOverride(symbol);
  const [simAmount, setSimAmount] = useSimAmount();
  const [showOptional, setShowOptional] = useState(false);
  const [custom, setCustom] = useState('');
  const [benchMsg, setBenchMsg] = useState<string>();
  const [levelOverride, setLevelOverride] = useState<Knowledge | null>(null);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const lastGood = useRef<{ symbol: string; cls: AssetClass } | null>(null);

  useEffect(() => {
    if (profile === null) router.replace('/profilo');
  }, [profile, router]);

  // The class is known once a report for this symbol has loaded; until then ask for no benchmark
  // and let the server pick the class default.
  const knownClass: AssetClass | undefined =
    fetched?.symbol === symbol ? (fetched.report?.instrument.assetClass ?? (fetched.report ? 'unknown' : undefined)) : undefined;
  const bench = (knownClass && benchPrefs[knownClass]) || '';
  const key = `${symbol}|${bench}|${reloadTick}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/report?symbol=${encodeURIComponent(symbol)}${bench ? `&benchmark=${encodeURIComponent(bench)}` : ''}`)
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setFetched({ key, symbol, error: j.error ?? FALLBACK_ERR });
          return;
        }
        const rep = j as Report;
        const cls = rep.instrument.assetClass ?? 'unknown';
        if ('error' in rep.benchmark) {
          // Never leave the user with a broken comparison: fall back to the last working benchmark.
          const def = defaultBenchmarkFor(cls);
          const good = lastGood.current?.cls === cls ? lastGood.current.symbol : null;
          const fallback = bench ? (good ?? (bench !== def ? (def ?? null) : null)) : null;
          if (fallback && fallback !== bench) {
            setBenchMsg(`${bench}: dati non trovati. Il confronto resta con ${fallback}.`);
            if (fallback === def) clearBenchPref(cls);
            else setBenchPref(cls, fallback);
            return;
          }
        } else {
          lastGood.current = { symbol: bench || rep.benchmark.profile.symbol, cls };
        }
        setFetched({ key, symbol, report: rep });
      })
      .catch(() => !cancelled && setFetched({ key, symbol, error: FALLBACK_ERR }));
    return () => {
      cancelled = true;
    };
  }, [key, symbol, bench, setBenchPref, clearBenchPref]);

  // Keep showing the current report while only the benchmark changes.
  const report = fetched?.symbol === symbol ? fetched.report : undefined;
  const refreshing = !!report && fetched?.key !== key;
  const level: Knowledge = levelOverride ?? profile?.knowledge ?? 'base';
  const rank = LEVEL_RANK[level];

  const ins = report?.instrument;
  const insClass: AssetClass = ins?.assetClass ?? 'unknown';
  const presets = benchmarksFor(insClass);
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

  const readings = useMemo(
    () =>
      report && profile
        ? fit.map((f) =>
            fitReading(f, profile, {
              maxDrawdown: report.metrics.maxDrawdown?.value,
              volatility: report.metrics.volatility,
              currency: report.instrument.currency,
              monthly: report.monthly,
            }),
          )
        : [],
    [fit, report, profile],
  );

  if (!profile) return <ReportSkeleton />;

  function chooseBench(v: string) {
    setBenchMsg(undefined);
    if (presets.some((p) => p.symbol === v)) setCustom('');
    if (v === defaultBenchmarkFor(insClass)) clearBenchPref(insClass);
    else setBenchPref(insClass, v);
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
        <Card className={cx('rise mt-2', toneEdge('bad'))}>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ToneIcon tone="bad" className="h-5 w-5 text-error" />
            Report non disponibile
          </h1>
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
  const isStock = ins.type === 'STOCK';
  const needsChoice = !benchOk && 'error' in report.benchmark && report.benchmark.symbol === '';
  const activeBench = bench || (benchOk?.profile.symbol ?? '');
  const hasOptional = presets.some((p) => p.optional);
  const optionalActive = presets.some((p) => p.optional && p.symbol.toUpperCase() === activeBench.toUpperCase());
  const shownPresets = presets.filter((p) => !p.optional || showOptional || optionalActive);
  const benchPreset = presets.find((p) => p.symbol.toUpperCase() === activeBench.toUpperCase());
  const noPresets = presets.length === 0;
  const ddTol = -Math.abs(profile.maxDrawdownPct);
  const ddTone = drawdownTone(dd?.value, profile.maxDrawdownPct);
  const volTone = volatilityTone(m.volatility, profile.horizonYears);
  const benchTer = benchOk?.profile.ter ?? (benchOk ? findBenchmark(benchOk.profile.symbol)?.ter : undefined);
  const retTone = signTone(best.value);

  const figures = [
    <Figure
      key="ret"
      label={best.label}
      value={best.value !== undefined && best.value > 0 ? `+${fmtPct(best.value)}` : fmtPct(best.value)}
      note={best.note}
      tip={TERMS.ret}
      tone={retTone}
      badge={retTone === 'good' ? 'In guadagno' : retTone === 'bad' ? 'In perdita' : undefined}
    />,
    <Figure
      key="dd"
      label="Perdita massima"
      value={fmtPct(dd?.value)}
      note={`La tua soglia: ${fmtNum(ddTol, 0)}%`}
      tip={TERMS.dd}
      tone={ddTone}
      badge={{ good: 'Entro la soglia', worry: 'Vicina alla soglia', bad: 'Oltre la soglia', neutral: undefined }[ddTone]}
    />,
    ...(rank >= 1
      ? [
          <Figure
            key="vol"
            label="Volatilità annua"
            value={fmtPct(m.volatility)}
            tip={TERMS.vol}
            tone={volTone}
            badge={{ good: 'Contenuta', worry: 'Ampia', bad: 'Molto ampia', neutral: undefined }[volTone]}
          />,
        ]
      : []),
  ];

  return (
    <div className="rise">
      {back}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-x-10">
        <div className="lg:col-start-1">
          <header>
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-3xl">{ins.name}</h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip tone="accent">{typeLabel(ins.type)}</Chip>
              {ins.currency && <Chip>{ins.currency}</Chip>}
              {ins.exchange && <Chip>{exchangeLabel(ins.exchange)}</Chip>}
              {ins.sector && <Chip>{sectorLabel(ins.sector)}</Chip>}
              {nameTags(ins.name).map((t) => (
                <Chip key={t} tone={t === 'Strategia con opzioni' ? 'warn' : 'bad'}>
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

          <EuroVerdict
            amount={simAmount}
            onAmount={setSimAmount}
            fund={{
              // without a reference there is no common period: fall back to the monthly closes
              prices: report.chart.length > 0 ? chartSeries(report.chart, 'a') : report.monthly,
              fees: effectiveFees(ins, userFees),
              ter: isStock ? undefined : ins.ter,
              currency: ins.currency,
              distribution: ins.distribution,
              dist: report.dist?.instrument,
            }}
            reference={
              benchOk && !sameAsBench && report.chart.length > 0
                ? { prices: chartSeries(report.chart, 'b'), fees: effectiveFees(benchOk.profile), ter: benchTer, currency: benchOk.profile.currency, distribution: benchOk.profile.distribution, dist: report.dist?.benchmark }
                : undefined
            }
            referenceLabel={benchOk ? findBenchmark(benchOk.profile.symbol)?.label : undefined}
          />

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

          <CostBlock
            fundTer={ins.ter}
            benchTer={benchTer}
            amount={simAmount}
            isStock={isStock}
            benchLabel={benchOk ? findBenchmark(benchOk.profile.symbol)?.label : undefined}
            fundExtra={
              isStock ? undefined : (
                <FeeRows
                  fees={effectiveFees(ins, userFees)}
                  dataMissing={{ entry: !ins.entryFee, exit: !ins.exitFee }}
                  userFees={userFees}
                  onUserFees={setUserFees}
                />
              )
            }
            benchExtra={benchOk ? <FeeRows fees={effectiveFees(benchOk.profile)} /> : undefined}
          />

          <Section id="h-bench" title="Confronto con un riferimento" aside={refreshing ? <Spinner className="h-5 w-5 text-muted" /> : undefined}>
            <p className="-mt-1 text-sm text-muted">{TERMS.bench}</p>
            {noPresets && (
              <p className="mt-3 text-sm text-muted">Tipo di strumento non riconosciuto: scegli tu il riferimento</p>
            )}
            {!noPresets && (
              <div role="radiogroup" aria-label="Riferimento" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {shownPresets.map((p) => {
                  const on = p.symbol.toUpperCase() === activeBench.toUpperCase();
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
                      <span className="text-xs text-muted">{p.name}</span>
                      <span className="text-xs text-muted">
                        {p.symbol} · <span className="text-[11px]">{p.isin}</span>
                      </span>
                    </button>
                  );
                })}
                {activeBench && !benchPreset && (
                  <span
                    role="radio"
                    aria-checked="true"
                    className="flex min-h-14 flex-col items-start justify-center rounded-xl border border-accent bg-accent-soft px-3 py-2 sm:col-span-2"
                  >
                    <span className="text-sm font-semibold text-accent">Personalizzato</span>
                    <span className="text-xs text-muted">{activeBench}</span>
                  </span>
                )}
              </div>
            )}
            {noPresets && activeBench && (
              <p className="mt-2 text-sm text-muted">
                Riferimento scelto: <span className="font-semibold text-ink">{findBenchmark(activeBench)?.label ?? activeBench}</span>
              </p>
            )}
            {hasOptional && (
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOptional || optionalActive}
                  disabled={optionalActive}
                  onChange={(e) => setShowOptional(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Mostra anche S&amp;P 500
              </label>
            )}
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
              <Callout tone="worry" role="status" className="mt-2">
                <p id="bench-msg">{benchMsg}</p>
              </Callout>
            )}

            {report.classNote && (
              <Callout tone="accent" className="mt-3">
                {report.classNote}
              </Callout>
            )}

            <div className={cx('transition-opacity', refreshing && 'opacity-50')}>
              {!benchOk ? (
                needsChoice ? (
                  <p className="mt-4 text-muted">Scegli un riferimento per vedere il confronto.</p>
                ) : (
                  <p className="mt-4 text-muted">
                    Riferimento {'symbol' in report.benchmark ? report.benchmark.symbol : bench}:{' '}
                    {'error' in report.benchmark ? report.benchmark.error : NA}
                  </p>
                )
              ) : sameAsBench ? (
                <Callout tone="accent" className="mt-4">
                  Lo strumento coincide con il riferimento scelto: seleziona un altro riferimento per vedere un confronto.
                </Callout>
              ) : (
                <>
                  {sameFund && (
                    <Callout tone="accent" className="mt-4">
                      Il riferimento scelto è lo stesso strumento quotato su un&apos;altra borsa: i valori sono quasi identici.
                    </Callout>
                  )}
                  {report.chart.length > 0 ? (
                    <PriceChart data={report.chart} nameA={ins.symbol} nameB={benchOk.profile.symbol} />
                  ) : (
                    <p className="mt-4 text-muted">Grafico: {NA}</p>
                  )}
                </>
              )}
            </div>
          </Section>

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
              <FitTally tones={readings.map((r) => r.tone)} />
              <ul className="space-y-2">
                {fit.map((f, i) => {
                  const r = readings[i] ?? { tone: 'neutral' as Tone };
                  return (
                    <li key={f.id} className={cx('card rounded-2xl border border-line bg-surface p-4', toneEdge(r.tone))}>
                      {r.label && (
                        <div className="mb-1.5">
                          <TonePill tone={r.tone}>{r.label}</TonePill>
                        </div>
                      )}
                      <p className="text-[0.9375rem] leading-6">
                        <ToneText text={f.text} rules={fitRules(f, r.tone)} />
                      </p>
                    </li>
                  );
                })}
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
          <dl className={cx('mt-4 grid grid-cols-2 gap-2', figures.length === 3 && 'sm:grid-cols-3 lg:grid-cols-2 max-sm:[&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-2')}>
            {figures}
          </dl>

          <SimilarProducts
            symbol={symbol}
            assetClass={insClass}
            volatility={report.metrics.volatility}
            prices={report.chart.length > 0 ? chartSeries(report.chart, 'a') : report.monthly}
            amount={simAmount}
          />

          <AiSummary report={report} fit={fit} level={level} />

          {benchOk && !sameAsBench && rank >= 1 && (
            <Section id="h-cmp" title="Confronto con il riferimento">
              <div className={cx('transition-opacity', refreshing && 'opacity-50')}>
                <BenchCompare a={ins} am={m} b={benchOk.profile} bm={benchOk.metrics} />
              </div>
            </Section>
          )}

          {rank >= 1 && (!benchOk || sameAsBench || rank >= 2) && (
            <Section id="h-perf" title={rank >= 2 ? 'Dettagli di calcolo' : 'Rendimenti per periodo'}>
              <Rows
                rows={[
                  // With a working comparison, returns per period are already in the comparison table.
                  ...((!benchOk || sameAsBench
                    ? [
                        ['Rendimento annuo, 1 anno', signedPct(m.return1y)],
                        ['Rendimento annuo, 3 anni', signedPct(m.return3y)],
                        ['Rendimento annuo, 5 anni', signedPct(m.return5y)],
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

          {(ins.holdings || ins.sectors || ins.countries || (rank >= 2 && (ins.country || !isStock))) && rank >= 1 && (
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
                    ['Utile netto', <SignedBig key="ni" v={ins.fundamentals.netIncome} currency={ins.fundamentals.currency} />],
                    ['Debito totale', fmtBig(ins.fundamentals.totalDebt, ins.fundamentals.currency)],
                    ['Free cash flow', <SignedBig key="fcf" v={ins.fundamentals.freeCashFlow} currency={ins.fundamentals.currency} />],
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
  // [label, a, b, higher is better, color by sign]
  const rows: [string, number | undefined, number | undefined, boolean, boolean][] = [
    ['Rendimento annuo, 1 anno', am.return1y, bm.return1y, true, true],
    ['Rendimento annuo, 3 anni', am.return3y, bm.return3y, true, true],
    ['Rendimento annuo, 5 anni', am.return5y, bm.return5y, true, true],
    ['Volatilità annua', am.volatility, bm.volatility, false, false],
    ['Perdita massima storica', am.maxDrawdown?.value, bm.maxDrawdown?.value, true, true],
  ];
  const isinCell = (p: InstrumentProfile) => (
    <td className="py-2.5 pr-3 text-right text-[11px] text-muted">{p.isin ?? 'Dato non disponibile'}</td>
  );
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
        <tr>
          <th scope="row" className="px-4 py-2.5 text-sm font-normal text-muted">
            ISIN
          </th>
          {isinCell(a)}
          {isinCell(b)}
        </tr>
        {rows.map(([k, x, y, higherBetter, signed]) => {
          const both = x !== undefined && y !== undefined && x !== y;
          const aWins = both && (higherBetter ? x > y : x < y);
          return (
            <tr key={k}>
              <th scope="row" className="px-4 py-2.5 text-sm font-normal text-muted">
                {k}
              </th>
              <CompareCell v={x} signed={signed} wins={aWins} className="pr-3" />
              <CompareCell v={y} signed={signed} wins={both && !aWins} className="pr-4" />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CompareCell({ v, signed, wins, className }: { v: number | undefined; signed: boolean; wins: boolean; className?: string }) {
  if (v === undefined || !Number.isFinite(v)) return <td className={cx('py-2.5 text-right text-xs text-muted', className)}>n.d.</td>;
  return (
    <td className={cx('py-2.5 text-right tabular-nums', className)}>
      <span className={cx('inline-flex items-center gap-1', wins ? 'font-bold' : 'font-medium')}>
        {wins && <span className="sr-only">Evidenziato: </span>}
        {wins && <ToneIcon tone="good" className="h-3.5 w-3.5 text-success" />}
        {signed ? <SignedPct v={v} /> : fmtPct(v)}
      </span>
    </td>
  );
}

function SignedBig({ v, currency }: { v: number | undefined; currency?: string }) {
  const s = fmtBig(v, currency);
  if (s === NA) return <>{NA}</>;
  return <span className={TONE_TEXT[v !== undefined && v < 0 ? 'bad' : 'neutral']}>{s}</span>;
}

/** One-line summary of the profile readings: how many points are fine, to watch, or over. */
function FitTally({ tones }: { tones: Tone[] }) {
  const n = (t: Tone) => tones.filter((x) => x === t).length;
  const items: [Tone, number, string][] = [
    ['bad', n('bad'), 'oltre il tuo profilo'],
    ['worry', n('worry'), 'da tenere d’occhio'],
    ['good', n('good'), 'in linea'],
  ];
  const shown = items.filter(([, c]) => c > 0);
  if (!shown.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {shown.map(([t, c, label]) => (
        <TonePill key={t} tone={t}>
          {c} {label}
        </TonePill>
      ))}
    </div>
  );
}

const PCT_RE = /-?\d+(?:,\d+)?%/;

/** Which words of each profile sentence carry the verdict. */
function fitRules(f: FitStatement, tone: Tone): HlRule[] {
  switch (f.id) {
    case 'drawdown':
      return [
        [/perdita massima storica \([^)]+\)/, tone],
        [/(supera la|è inferiore alla|coincide con la) soglia indicata \([^)]+\)( di [\d,]+ punt[oi])?/, tone],
      ];
    case 'volatility':
      return [[/Volatilità annua [\d,]+%/, tone]];
    case 'rolling':
      return [[PCT_RE, (m) => (m.startsWith('-') ? 'bad' : m === '0,0%' ? 'neutral' : 'good')]];
    case 'currency':
      return [
        [/nessuna esposizione al cambio sulla quotazione/, 'good'],
        [/esposizione al cambio EUR\/\w+/, 'worry'],
      ];
  }
}

const BAR_COLORS = ['var(--bar-1)', 'var(--bar-2)', 'var(--bar-3)', 'var(--bar-4)', 'var(--bar-5)', 'var(--bar-6)'];

function AllocList({ title, items }: { title: string; items: { key: string; name: string; weight: number }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="mt-2 space-y-2.5">
        {items.map((h, i) => (
          <li key={h.key}>
            <div className="flex justify-between gap-4 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                <span className="truncate">{h.name}</span>
              </span>
              <span className="font-medium tabular-nums">{fmtPct(h.weight)}</span>
            </div>
            <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${Math.min(h.weight, 1) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
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
  if (full && ins.type !== 'STOCK' && !ins.countries) facts.push(['Ripartizione per paese', NA]);
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
