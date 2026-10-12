'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Report, Metrics } from '@/lib/report';
import type { AssetClass, InstrumentProfile } from '@/lib/data/types';
import { benchmarksFor, defaultBenchmarkFor, findBenchmark } from '@/lib/benchmarks';
import { profileFit, NA, type FitStatement, type Knowledge } from '@/lib/profileFit';
import { drawdownTone, fitReading, terTone, volatilityTone, type Tone } from '@/lib/tone';
import { terCostPerYear } from '@/lib/costs';
import { fmtBig, fmtDate, fmtEur, fmtNum, fmtPct } from '@/lib/format';
import { pushRecentReport, useBenchmarkPrefs, useFeeOverride, useFxCost, useInvestorProfile, useSimAmount } from '@/lib/profileStore';
import { countryLabel, exchangeLabel, nameTags, sectorLabel, typeLabel } from '@/lib/labels';
import { PriceChart } from './PriceChart';
import { CostBlock, TER_BADGE } from './CostBlock';
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
  Disclosure,
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
  ter: 'Spese annue di gestione di un fondo o ETF, già incluse nel prezzo: non si pagano a parte.',
  bench: "Uno strumento di riferimento con cui confrontare l'andamento. Puoi sceglierne uno diverso.",
};

type Fetched = { key: string; symbol: string; report?: Report; error?: string };

function Section({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <h2 id={id} className="scroll-mt-28 text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Rows({ rows, bare }: { rows: [ReactNode, ReactNode][]; bare?: boolean }) {
  return (
    <dl className={cx('divide-y divide-line', !bare && 'card overflow-hidden rounded-2xl border border-line bg-surface')}>
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
    <div className="card flex flex-col rounded-2xl border border-line bg-surface p-2.5 sm:p-3.5">
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
          'mt-auto pt-0.5 tabular-nums sm:pt-1',
          na ? 'text-base font-medium text-muted' : cx('text-xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]', TONE_TEXT[tone]),
        )}
      >
        {value}
      </dd>
      {badge && !na && (
        <dd className="mt-1 sm:mt-1.5">
          <TonePill tone={tone}>{badge}</TonePill>
        </dd>
      )}
      {note && <dd className="mt-0.5 text-xs text-muted sm:mt-1">{note}</dd>}
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
  const [fxCost, setFxCost, fxCostIsUser] = useFxCost();
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
  // Stable series for the euro box and the similar products: typing an amount must not rebuild them
  const fundSeries = useMemo(() => (report ? (report.chart.length > 0 ? chartSeries(report.chart, 'a') : report.monthly) : []), [report]);
  const benchSeries = useMemo(() => (report && report.chart.length > 0 ? chartSeries(report.chart, 'b') : []), [report]);
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

  // A link such as /report/X#h-comp lands before the content exists: scroll once it has rendered,
  // and again when the AI summary settles (it may collapse and shift the page) unless the user has scrolled since
  const scrolledFor = useRef<string | null>(null);
  const hashTarget = useRef<string | null>(null);
  const scrollToHash = () => {
    if (hashTarget.current) document.getElementById(hashTarget.current)?.scrollIntoView();
  };
  useEffect(() => {
    if (!report || !profile || scrolledFor.current === symbol) return;
    scrolledFor.current = symbol;
    const target = decodeURIComponent(window.location.hash.slice(1));
    if (!target) return;
    hashTarget.current = target;
    const stop = () => {
      hashTarget.current = null;
      for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.removeEventListener(ev, stop);
    };
    for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.addEventListener(ev, stop, { passive: true });
    setTimeout(stop, 8000);
    requestAnimationFrame(scrollToHash);
  }, [report, profile, symbol]);

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

  const terCost = terCostPerYear(simAmount, ins.ter);
  const terT = terTone(ins.ter);
  const refName = benchOk ? (findBenchmark(benchOk.profile.symbol)?.label ?? benchOk.profile.name) : undefined;
  const fees = effectiveFees(ins, userFees);
  const hasUserFees = userFees.entry !== undefined || userFees.exit !== undefined;
  // Fees that can change the simulation stay in view: a missing one the user can enter, or a performance fee
  const costOpen = ((!ins.entryFee || !ins.exitFee) && !hasUserFees) || !!fees.performance;

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
      label="Perdita massima storica"
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
    ...(isStock
      ? []
      : [
          <Figure
            key="ter"
            label="Costo annuo (TER)"
            value={fmtPct(ins.ter, 2)}
            note={terCost === undefined ? undefined : `≈ ${fmtEur(terCost)} l'anno su ${fmtEur(simAmount)}`}
            tip={TERMS.ter}
            tone={terT}
            badge={TER_BADGE[terT]}
          />,
        ]),
  ];
  const figureCols = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[figures.length] ?? 'lg:grid-cols-4';

  // The one statement that matters most: first over the profile, else to watch, else fine
  const tones = readings.map((r) => r.tone);
  const worstIdx = (['bad', 'worry', 'good'] as Tone[]).map((t) => tones.indexOf(t)).find((i) => i >= 0) ?? -1;
  const worst = worstIdx >= 0 ? fit[worstIdx] : undefined;

  const meta = [
    ins.currency,
    ins.exchange && exchangeLabel(ins.exchange),
    ins.sector && sectorLabel(ins.sector),
    ins.symbol,
    ins.isin && `ISIN ${ins.isin}`,
    m.historyEnd && `dati al ${fmtDate(m.historyEnd)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const showComp = (ins.holdings || ins.sectors || ins.countries || (rank >= 2 && (ins.country || !isStock))) && rank >= 1;
  const jump = [
    { href: '#h-bench', label: 'Andamento' },
    { href: '#h-euro', label: 'Simulazione' },
    { href: '#h-fit', label: 'Profilo' },
    ...(isStock ? [] : [{ href: '#h-cost', label: 'Costi' }]),
    ...(showComp ? [{ href: '#h-comp', label: 'Composizione' }] : []),
  ];

  return (
    <div className="rise">
      {back}
      <JumpNav items={jump} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-x-10">
        <div className="lg:col-start-1">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-3xl">{ins.name}</h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Chip tone="accent">{typeLabel(ins.type)}</Chip>
                {nameTags(ins.name).map((t) => (
                  <Chip key={t} tone={t === 'Strategia con opzioni' ? 'warn' : 'bad'}>
                    {t}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">{meta}</p>
            </div>
            <div className="sm:w-72 sm:shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Dettaglio</span>
                <div className="min-w-0 flex-1">
                  <SegmentedControl
                    compact
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
                </div>
              </div>
              {levelOverride && levelOverride !== profile.knowledge && (
                <p className="mt-1.5 text-xs text-muted">Solo per questa pagina. Il livello predefinito si cambia dal Profilo.</p>
              )}
            </div>
          </header>

          <section aria-labelledby="h-brief" className="card mt-6 scroll-mt-28 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h2 id="h-brief" className="text-lg font-semibold tracking-tight">
              In breve
            </h2>
            {worst && (
              <div className="mt-2">
                <FitTally tones={tones} />
                <p className="mt-2 text-[0.9375rem] leading-6">
                  <ToneText text={worst.text} rules={fitRules(worst, tones[worstIdx])} />{' '}
                  <a href="#h-fit" className="whitespace-nowrap font-medium text-accent underline underline-offset-2">
                    Vedi tutti i punti
                  </a>
                </p>
              </div>
            )}
            <dl className={cx('mt-3 grid grid-cols-2 gap-2', figureCols, '[&>*:last-child:nth-child(odd)]:max-lg:col-span-2')}>{figures}</dl>
            {(refName || needsChoice) && (
              <p className="mt-3 text-sm text-muted">
                {sameAsBench ? (
                  'Nessun confronto: lo strumento coincide con il riferimento scelto'
                ) : refName ? (
                  <>
                    Confrontato con: <span className="font-medium text-ink">{refName}</span>
                    {benchOk ? ` (${benchOk.profile.symbol})` : ''}
                  </>
                ) : (
                  'Nessun riferimento scelto'
                )}{' '}
                ·{' '}
                <a href="#h-pick" className="font-medium text-accent underline underline-offset-2">
                  Cambia
                </a>
              </p>
            )}
          </section>

          <AiSummary report={report} fit={fit} level={level} onSettle={scrollToHash} />

          <Section id="h-bench" title="Andamento rispetto al riferimento" aside={refreshing ? <Spinner className="h-5 w-5 text-muted" /> : undefined}>
            <p className="-mt-1 text-sm text-muted">{TERMS.bench}</p>
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
                  {rank >= 1 && <BenchCompare a={ins} am={m} b={benchOk.profile} bm={benchOk.metrics} />}
                </>
              )}
            </div>

            <Disclosure
              id="h-pick"
              variant="sub"
              title="Cambia riferimento"
              preview={sameAsBench ? 'Lo strumento stesso: scegline un altro' : benchOk ? `${refName} (${benchOk.profile.symbol})` : 'Scegli un riferimento'}
              forceOpen={needsChoice || !benchOk || !!benchMsg}
              className="mt-4"
            >
              {noPresets && <p className="text-sm text-muted">Tipo di strumento non riconosciuto: scegli tu il riferimento</p>}
              {!noPresets && (
                <div role="radiogroup" aria-label="Riferimento" className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
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
                          'pressable flex min-h-11 flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left sm:min-h-14 sm:py-2',
                          on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                        )}
                      >
                        <span className={cx('text-sm font-semibold', on && 'text-accent')}>
                          {p.label}
                          <span className="font-normal text-muted sm:hidden"> · {p.symbol}</span>
                        </span>
                        <span className={cx('text-xs text-muted', !on && 'max-sm:hidden')}>{p.name}</span>
                        <span className={cx('text-xs text-muted', !on && 'max-sm:hidden')}>
                          <span className="max-sm:hidden">{p.symbol} · </span>
                          <span className="text-[11px]">{p.isin}</span>
                        </span>
                      </button>
                    );
                  })}
                  {activeBench && !benchPreset && (
                    <span
                      role="radio"
                      aria-checked="true"
                      className="flex min-h-11 flex-col items-start justify-center rounded-xl border border-accent bg-accent-soft px-3 py-2 sm:col-span-2"
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
            </Disclosure>
          </Section>

          <EuroVerdict
            amount={simAmount}
            onAmount={setSimAmount}
            fxCost={fxCost}
            onFxCost={setFxCost}
            fxCostIsUser={fxCostIsUser}
            taxCountry={profile.taxCountry}
            fund={{
              // without a reference there is no common period: fall back to the monthly closes
              prices: fundSeries,
              fees,
              ter: isStock ? undefined : ins.ter,
              currency: ins.currency,
              distribution: ins.distribution,
              dist: report.dist?.instrument,
              fx: report.fx?.instrument,
              type: ins.type,
              assetClass: ins.assetClass,
              govtShare: findBenchmark(ins.symbol)?.govtShare,
            }}
            reference={
              benchOk && !sameAsBench && report.chart.length > 0
                ? { prices: benchSeries, fees: effectiveFees(benchOk.profile), ter: benchTer, currency: benchOk.profile.currency, distribution: benchOk.profile.distribution, dist: report.dist?.benchmark, fx: report.fx?.benchmark, type: benchOk.profile.type, assetClass: benchOk.profile.assetClass, govtShare: findBenchmark(benchOk.profile.symbol)?.govtShare }
                : undefined
            }
            referenceLabel={benchOk && !sameAsBench ? findBenchmark(benchOk.profile.symbol)?.label : undefined}
            referenceNote={sameAsBench ? 'Il riferimento scelto è lo strumento stesso: scegli un altro riferimento per vedere il confronto.' : undefined}
          />
        </div>

        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:-m-1 lg:p-1">
            <Disclosure id="h-fit" title="Rispetto al tuo profilo" preview={tones.length > 0 ? <FitTally tones={tones} /> : undefined} openOnDesktop className="lg:mt-0">
              <div className="-mt-1 mb-3 flex flex-wrap items-center justify-between gap-x-3">
                <p className="text-sm text-muted">
                  Soglia di perdita {fmtNum(profile.maxDrawdownPct, 0)}% · orizzonte {profile.horizonYears} {profile.horizonYears === 1 ? 'anno' : 'anni'}
                </p>
                <Link
                  href="/profilo"
                  className="pressable -mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  Modifica profilo
                </Link>
              </div>
              <ul className="space-y-2">
                {fit.map((f, i) => {
                  const r = readings[i] ?? { tone: 'neutral' as Tone };
                  if (r.tone === 'neutral' && !r.label)
                    return (
                      <li key={f.id} className="px-1 text-sm text-muted">
                        <p className="flex gap-2">
                          <ToneIcon tone="neutral" className="mt-0.5" />
                          <span>{f.text}</span>
                        </p>
                        {f.id === 'rolling' && <RollingHelp />}
                      </li>
                    );
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
                      {f.id === 'rolling' && <RollingHelp />}
                    </li>
                  );
                })}
              </ul>
            </Disclosure>
          </div>
        </aside>

        <div className="lg:col-start-1">
          {isStock ? (
            <p className="mt-8 text-sm text-muted">
              <span className="font-medium text-ink">Costi:</span> nessun TER (le azioni non hanno spese correnti). Commissioni del broker non incluse.
              {benchTer !== undefined && ` Il riferimento ha un TER di ${fmtPct(benchTer, 2)}.`}
            </p>
          ) : (
            <CostBlock
              key={symbol}
              fundTer={ins.ter}
              benchTer={benchTer}
              amount={simAmount}
              fees={fees}
              benchLabel={refName}
              defaultOpen={costOpen}
              fundExtra={
                <FeeRows fees={fees} dataMissing={{ entry: !ins.entryFee, exit: !ins.exitFee }} userFees={userFees} onUserFees={setUserFees} />
              }
              benchExtra={benchOk ? <FeeRows fees={effectiveFees(benchOk.profile)} /> : undefined}
            />
          )}

          {rank >= 1 && (!benchOk || sameAsBench || rank >= 2) && (
            <Disclosure
              key={`perf-${symbol}`}
              id="h-perf"
              title={rank >= 2 ? 'Dettagli di calcolo' : 'Rendimenti per periodo'}
              preview={
                rank >= 2
                  ? m.historyStart
                    ? `Storico disponibile ${fmtDate(m.historyStart)} – ${fmtDate(m.historyEnd)}`
                    : undefined
                  : `1 anno ${fmtPct(m.return1y)} · 3 anni ${fmtPct(m.return3y)} · 5 anni ${fmtPct(m.return5y)}`
              }
            >
              <Rows
                bare
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
            </Disclosure>
          )}

          {showComp && (
            <Disclosure key={`comp-${symbol}`} id="h-comp" title="Composizione" preview={compositionPreview(ins)}>
              <Composition ins={ins} full={rank >= 2} />
            </Disclosure>
          )}

          {ins.type === 'STOCK' && rank >= 1 && (
            <Disclosure
              key={`fond-${symbol}`}
              id="h-fond"
              title="Bilancio (ultimo esercizio)"
              preview={
                ins.fundamentals
                  ? [
                      `Ricavi ${fmtBig(ins.fundamentals.revenue, ins.fundamentals.currency)}`,
                      `Utile netto ${fmtBig(ins.fundamentals.netIncome, ins.fundamentals.currency)}`,
                      ins.fundamentals.fiscalYear ? `FY${ins.fundamentals.fiscalYear}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : undefined
              }
            >
              {ins.fundamentals ? (
                <Rows
                  bare
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
            </Disclosure>
          )}

          {rank >= 2 && report.notes.length > 0 && (
            <Disclosure id="h-note" title="Note di calcolo" preview={`${report.notes.length} ${report.notes.length === 1 ? 'nota' : 'note'}`}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {report.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Disclosure>
          )}

          {!isStock && (
            <SimilarProducts
              symbol={symbol}
              assetClass={insClass}
              volatility={report.metrics.volatility}
              prices={fundSeries}
              amount={simAmount}
              referenceSymbol={benchOk?.profile.symbol}
            />
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

/** Quick-jump chips for phones, shown once the "In breve" card has scrolled out of view. */
function JumpNav({ items }: { items: { href: string; label: string }[] }) {
  const [show, setShow] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  // Fade the edge(s) where more chips are hidden, so the row reads as scrollable
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = () => {
    const el = listRef.current;
    if (el) setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [show]);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 420);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 h-0 lg:hidden">
      <nav
        aria-label="Sezioni del report"
        className={cx('absolute -inset-x-4 top-0 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-inset-x-6 sm:px-6', !show && 'hidden')}
      >
        <ul
          ref={listRef}
          onScroll={measure}
          className="flex gap-0.5 overflow-x-auto py-1"
          style={{
            maskImage: `linear-gradient(to right, ${edges.start ? 'transparent, #000 1.5rem' : '#000, #000'}, ${edges.end ? '#000 calc(100% - 1.5rem), transparent' : '#000, #000'})`,
          }}
        >
          {items.map((it) => (
            <li key={it.href} className="shrink-0">
              <a href={it.href} className="pressable inline-flex min-h-11 items-center rounded-full px-2.5 text-sm font-medium text-accent hover:bg-accent-soft">
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function RollingHelp() {
  return (
    <details className="mt-1 text-sm">
      <summary className="pressable inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 font-medium text-accent hover:bg-accent-soft">
        Come leggo questo punto?
      </summary>
      <p className="mt-1 px-2 text-muted">
        Si prendono tutti i periodi di durata pari al tuo orizzonte presenti nello storico (uno per ogni mese di partenza) e si calcola il rendimento
        annuo di ciascuno. Il risultato mostra il periodo con il rendimento più basso e quello con il più alto.
      </p>
    </details>
  );
}

/** One line for the collapsed "Composizione": the biggest weights of whatever breakdown exists. */
function compositionPreview(ins: InstrumentProfile): string | undefined {
  const top = (label: string, xs: { name: string; weight: number }[] | undefined) =>
    xs && xs.length > 0 ? `${label}: ${xs.slice(0, 3).map((x) => `${x.name} ${fmtPct(x.weight)}`).join(', ')}${xs.length > 3 ? '…' : ''}` : undefined;
  return top('Principali posizioni', ins.holdings) ?? top('Settori', ins.sectors) ?? top('Paesi', ins.countries?.map((c) => ({ name: countryLabel(c.name), weight: c.weight })));
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
    <span className="flex flex-wrap gap-1.5">
      {shown.map(([t, c, label]) => (
        <TonePill key={t} tone={t}>
          {c} {label}
        </TonePill>
      ))}
    </span>
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
      <h3 className="text-sm font-semibold">{title}</h3>
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
        <div className="space-y-6">
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
        </div>
      )}
      {facts.length > 0 && <Rows bare rows={facts} />}
    </div>
  );
}
