import { cached, TTL_PRICES, TTL_PROFILE } from './cache';
import { BENCHMARKS, defaultBenchmarkFor, findBenchmark } from './benchmarks';
import { applyCostOverrides } from './data/costOverrides';
import { yahooProvider } from './data/yahoo';
import type { DataProvider } from './data/provider';
import { effectiveFees } from './fees';
import { fmtEur, fmtMonthYear } from './format';
import { DEFAULT_SIM_AMOUNT, simulate } from './simulation';
import { alignRates, fxSymbol } from './fx';
import { detectDistribution } from './distribution';
import { growthRatio, similarProducts, type FundPeriods, type SimilarItem } from './similar';
import type { AssetClass, DividendEvent, InstrumentProfile, PricePoint, SymbolCandidate } from './data/types';
import {
  annualizedReturn,
  annualizedVolatility,
  annualizedVolatilityDetail,
  maxDrawdown,
  monthlyCloses,
  rebase,
  type Drawdown,
  type RebasedPoint,
} from './metrics';

export const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;
const HISTORY_YEARS = 20;
/** Benchmark error text when the class has no default and none was asked for (empty symbol). */
export const CHOOSE_BENCHMARK = 'Scegli un riferimento';

export interface Metrics {
  return1y?: number;
  return3y?: number;
  return5y?: number;
  volatility?: number;
  /** Years of history used for volatility */
  volatilityYears?: number;
  maxDrawdown?: Drawdown;
  historyStart?: string;
  historyEnd?: string;
}

export interface DistData {
  raw: PricePoint[];
  dividends: DividendEvent[];
}

export interface Report {
  instrument: InstrumentProfile;
  benchmark: { profile: InstrumentProfile; metrics: Metrics } | { symbol: string; error: string };
  metrics: Metrics;
  /** Both rebased to 100 on the first common date; a = instrument, b = benchmark */
  chart: RebasedPoint[];
  /** Monthly closes of the instrument, for client-side rolling-window comparison */
  monthly: PricePoint[];
  notes: string[];
  /** Distributing products only: raw closes on the dates of the euro-simulation series, plus the payments per share */
  dist?: { instrument?: DistData; benchmark?: DistData };
  /** Non-EUR products only: currency-per-EUR rates on the dates of the euro-simulation series (dates without a usable rate are left out) */
  fx?: { instrument?: PricePoint[]; benchmark?: PricePoint[] };
  /** Shown next to the benchmark choice when instrument and benchmark are of different known classes */
  classNote?: string;
  generatedAt: string;
}

const CLASS_LABEL: Record<AssetClass, string> = {
  equity: 'azionario',
  bond: 'obbligazionario',
  mixed: 'bilanciato',
  other: 'altro',
  unknown: '',
};

/** Neutral note when both classes are known and differ; undefined otherwise. a = instrument, b = benchmark. */
export function classMismatch(a: AssetClass | undefined, b: AssetClass | undefined): string | undefined {
  if (!a || !b || a === 'unknown' || b === 'unknown' || a === b) return undefined;
  return `Strumento di tipo diverso (${CLASS_LABEL[b]} vs ${CLASS_LABEL[a]}): il confronto potrebbe non essere omogeneo.`;
}

/** The benchmark's own class; the curated class fills in when the profile could not tell. */
function benchmarkClass(p: InstrumentProfile): AssetClass | undefined {
  return p.assetClass && p.assetClass !== 'unknown' ? p.assetClass : findBenchmark(p.symbol)?.assetClass;
}

const provider: DataProvider = yahooProvider;

export function computeMetrics(prices: PricePoint[]): Metrics {
  const vol = annualizedVolatilityDetail(prices);
  return {
    return1y: annualizedReturn(prices, 1),
    return3y: annualizedReturn(prices, 3),
    return5y: annualizedReturn(prices, 5),
    volatility: vol?.value,
    volatilityYears: vol ? Math.round(vol.years * 10) / 10 : undefined,
    maxDrawdown: maxDrawdown(prices),
    historyStart: prices[0]?.date,
    historyEnd: prices.at(-1)?.date,
  };
}

export function searchInstruments(q: string): Promise<SymbolCandidate[]> {
  return cached(`search:${q.trim().toUpperCase()}`, TTL_PROFILE, () => provider.resolve(q));
}

const profileOf = (s: string) =>
  cached(`profile:v2:${s}`, TTL_PROFILE, async () => {
    const p = applyCostOverrides(await provider.getProfile(s));
    const distribution = detectDistribution(p.symbol, p.name, p.type);
    return distribution ? { ...p, distribution } : p;
  });
export const getInstrumentProfile = (s: string) => profileOf(s);
const historyOf = (s: string) =>
  cached(`history:${s}:${HISTORY_YEARS}`, TTL_PRICES, () => provider.getHistory(s, HISTORY_YEARS));

const rawHistoryOf = (s: string) =>
  cached(`rawhistory:${s}:${HISTORY_YEARS}`, TTL_PRICES, () => provider.getRawHistory(s, HISTORY_YEARS));
const dividendsOf = (s: string) =>
  cached(`dividends:${s}:${HISTORY_YEARS}`, TTL_PRICES, () => provider.getDividends(s, HISTORY_YEARS));

/**
 * Raw closes on exactly the dates of `dates` plus the dividend events, for a distributing product.
 * Undefined when either is missing: the client then falls back to the adjusted series and says so, never estimates.
 */
async function loadDistData(symbol: string, dates: string[]): Promise<DistData | undefined> {
  try {
    const [rawAll, dividends] = await Promise.all([rawHistoryOf(symbol), dividendsOf(symbol)]);
    if (dividends.length === 0) return undefined;
    const byDate = new Map(rawAll.map((p) => [p.date, p.close]));
    const raw: PricePoint[] = [];
    for (const date of dates) {
      const close = byDate.get(date);
      if (close !== undefined) raw.push({ date, close });
    }
    return raw.length >= 2 ? { raw, dividends } : undefined;
  } catch {
    return undefined;
  }
}

const fxHistoryOf = (symbol: string) =>
  cached(`fx:${symbol}:${HISTORY_YEARS}`, TTL_PRICES, () => provider.getHistory(symbol, HISTORY_YEARS));

/** Rates for a non-EUR quote currency aligned to `dates`; undefined for EUR, an unknown currency or when the rates cannot be loaded. */
async function loadFxData(currency: string | undefined, dates: string[]): Promise<PricePoint[] | undefined> {
  const symbol = fxSymbol(currency);
  if (!symbol || dates.length === 0) return undefined;
  try {
    const rates = alignRates(await fxHistoryOf(symbol), dates);
    return rates.length >= 2 ? rates : undefined;
  } catch {
    return undefined;
  }
}

/** `final` is false when the data could not be loaded (retry later) and true when "no line" is by design. */
export interface ShareEuro {
  line?: string;
  final: boolean;
}

const monthYear = (iso: string) => `${fmtMonthYear(iso).split(' ')[0]} ${iso.slice(0, 4)}`;

/**
 * Full-history euro line for the share image: default amount, fund only, fees as known (never estimated).
 * No line (final) for a non-euro quote (no conversion is made) or a history too short to simulate.
 */
export async function buildShareEuro(symbol: string): Promise<ShareEuro> {
  try {
    const [instrument, prices] = await Promise.all([profileOf(symbol), historyOf(symbol)]);
    if (instrument.currency !== 'EUR' || prices.length < 2) return { final: true };
    const dist = instrument.distribution === 'dist' ? await loadDistData(symbol, prices.map((p) => p.date)) : undefined;
    const fees = effectiveFees(instrument);
    const sim = simulate({ amount: DEFAULT_SIM_AMOUNT, prices, entryFee: fees.entry?.value, exitFee: fees.exit?.value, rawPrices: dist?.raw, dividends: dist?.dividends });
    if (!sim) return { final: true };
    return { line: `${fmtEur(DEFAULT_SIM_AMOUNT)} → ${fmtEur(sim.netValue)} (${monthYear(sim.startDate)} – ${monthYear(sim.endDate)}, dati storici)`, final: true };
  } catch {
    return { final: false };
  }
}

export async function buildReport(symbol: string, requestedBenchmark?: string): Promise<Report> {
  const [instrument, prices] = await Promise.all([profileOf(symbol), historyOf(symbol)]);
  const notes: string[] = [];
  if (prices.length === 0) notes.push('Storico prezzi: Dato non disponibile.');

  const benchmarkSymbol = requestedBenchmark || defaultBenchmarkFor(instrument.assetClass);

  let benchmark: Report['benchmark'];
  let chart: RebasedPoint[] = [];
  let classNote: string | undefined;
  if (!benchmarkSymbol) {
    benchmark = { symbol: '', error: CHOOSE_BENCHMARK };
  } else {
    try {
      const [bProfile, bPrices] = await Promise.all([profileOf(benchmarkSymbol), historyOf(benchmarkSymbol)]);
      benchmark = { profile: bProfile, metrics: computeMetrics(bPrices) };
      chart = rebase(prices, bPrices);
      if (bProfile.currency && instrument.currency && bProfile.currency !== instrument.currency) {
        notes.push(
          `I prezzi sono nelle rispettive valute di quotazione (${instrument.currency} e ${bProfile.currency}); il confronto non include l'effetto cambio.`,
        );
      }
      const mismatch = classMismatch(instrument.assetClass, benchmarkClass(bProfile));
      classNote = mismatch;
      if (chart.length === 0) notes.push('Nessuna data in comune tra strumento e benchmark: grafico Dato non disponibile.');
    } catch {
      benchmark = { symbol: benchmarkSymbol, error: 'Benchmark non trovato o dati non disponibili' };
    }
  }

  const monthly = monthlyCloses(prices);
  const chartDates = chart.map((p) => p.date);
  const [instDist, benchDist] = await Promise.all([
    instrument.distribution === 'dist' ? loadDistData(symbol, chartDates.length > 0 ? chartDates : monthly.map((p) => p.date)) : undefined,
    'profile' in benchmark && benchmark.profile.distribution === 'dist' && chartDates.length > 0
      ? loadDistData(benchmark.profile.symbol, chartDates)
      : undefined,
  ]);
  const simDates = chartDates.length > 0 ? chartDates : monthly.map((p) => p.date);
  const [instFx, benchFx] = await Promise.all([
    loadFxData(instrument.currency, simDates),
    'profile' in benchmark && chartDates.length > 0 ? loadFxData(benchmark.profile.currency, chartDates) : undefined,
  ]);
  const fx = instFx || benchFx ? { instrument: instFx, benchmark: benchFx } : undefined;
  const dist = instDist || benchDist ? { instrument: instDist, benchmark: benchDist } : undefined;

  return {
    instrument,
    benchmark,
    metrics: computeMetrics(prices),
    chart,
    monthly,
    notes,
    dist,
    fx,
    classNote,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Curated products of the instrument's class with the closest volatility, plus their growth ratio over the fund's periods.
 * Histories come through the shared cache and load in parallel; a failed candidate is skipped.
 */
export async function buildSimilar(symbol: string, periods: FundPeriods): Promise<SimilarItem[]> {
  const [instrument, prices] = await Promise.all([profileOf(symbol), historyOf(symbol)]);
  const cls = instrument.assetClass;
  if (!cls || cls === 'unknown' || cls === 'other') return [];
  const vol = annualizedVolatility(prices);
  if (vol === undefined) return [];
  const loaded = await Promise.all(
    BENCHMARKS.filter((b) => b.assetClass === cls).map(async (benchmark) => {
      try {
        const [profile, history] = await Promise.all([profileOf(benchmark.symbol), historyOf(benchmark.symbol)]);
        return { benchmark, profile, history, vol: annualizedVolatility(history) };
      } catch {
        return undefined;
      }
    }),
  );
  const ok = loaded.filter((c): c is NonNullable<typeof c> => !!c);
  const picked = similarProducts(cls, vol, ok, undefined, { symbol: instrument.symbol, isin: instrument.isin });
  return picked.map(({ benchmark, vol: v }) => {
    const c = ok.find((x) => x.benchmark === benchmark)!;
    return {
      symbol: benchmark.symbol,
      isin: benchmark.isin,
      name: benchmark.name,
      ter: c.profile.ter ?? benchmark.ter,
      vol: v,
      distribution: c.profile.distribution ?? benchmark.distribution,
      entryFee: c.profile.entryFee?.value,
      exitFee: c.profile.exitFee?.value,
      growth: { full: growthRatio(c.history, periods.full), year: growthRatio(c.history, periods.year) },
    };
  });
}
