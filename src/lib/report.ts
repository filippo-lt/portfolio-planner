import { cached, TTL_PRICES, TTL_PROFILE } from './cache';
import { yahooProvider } from './data/yahoo';
import type { DataProvider } from './data/provider';
import type { InstrumentProfile, PricePoint, SymbolCandidate } from './data/types';
import {
  annualizedReturn,
  annualizedVolatilityDetail,
  maxDrawdown,
  monthlyCloses,
  rebase,
  type Drawdown,
  type RebasedPoint,
} from './metrics';

export const DEFAULT_BENCHMARK = 'VWCE.DE';
export const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;
const HISTORY_YEARS = 20;

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

export interface Report {
  instrument: InstrumentProfile;
  benchmark: { profile: InstrumentProfile; metrics: Metrics } | { symbol: string; error: string };
  metrics: Metrics;
  /** Both rebased to 100 on the first common date; a = instrument, b = benchmark */
  chart: RebasedPoint[];
  /** Monthly closes of the instrument, for client-side rolling-window comparison */
  monthly: PricePoint[];
  notes: string[];
  generatedAt: string;
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

const profileOf = (s: string) => cached(`profile:${s}`, TTL_PROFILE, () => provider.getProfile(s));
export const getInstrumentProfile = (s: string) => profileOf(s);
const historyOf = (s: string) =>
  cached(`history:${s}:${HISTORY_YEARS}`, TTL_PRICES, () => provider.getHistory(s, HISTORY_YEARS));

export async function buildReport(symbol: string, benchmarkSymbol: string = DEFAULT_BENCHMARK): Promise<Report> {
  const [instrument, prices] = await Promise.all([profileOf(symbol), historyOf(symbol)]);
  const notes: string[] = [];
  if (prices.length === 0) notes.push('Storico prezzi: Dato non disponibile.');

  let benchmark: Report['benchmark'];
  let chart: RebasedPoint[] = [];
  try {
    const [bProfile, bPrices] = await Promise.all([profileOf(benchmarkSymbol), historyOf(benchmarkSymbol)]);
    benchmark = { profile: bProfile, metrics: computeMetrics(bPrices) };
    chart = rebase(prices, bPrices);
    if (bProfile.currency && instrument.currency && bProfile.currency !== instrument.currency) {
      notes.push(
        `I prezzi sono nelle rispettive valute di quotazione (${instrument.currency} e ${bProfile.currency}); il confronto non include l'effetto cambio.`,
      );
    }
    if (chart.length === 0) notes.push('Nessuna data in comune tra strumento e benchmark: grafico Dato non disponibile.');
  } catch {
    benchmark = { symbol: benchmarkSymbol, error: 'Benchmark non trovato o dati non disponibili' };
  }

  return {
    instrument,
    benchmark,
    metrics: computeMetrics(prices),
    chart,
    monthly: monthlyCloses(prices),
    notes,
    generatedAt: new Date().toISOString(),
  };
}
