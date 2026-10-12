/** Isomorphic and pure: picks curated products of the same class with the volatility closest to the analysed instrument. */
import type { Benchmark } from './benchmarks';
import type { AssetClass, PricePoint } from './data/types';
import { lastYearStart, simulate } from './simulation';

export const SIMILAR_RULE = 'Ordinati per volatilità più vicina a quella dello strumento analizzato.';
export const SIMILAR_COUNT = 3;

export interface SimilarCandidate {
  benchmark: Benchmark;
  /** Annualized volatility; candidates without it are skipped, never guessed */
  vol: number | undefined;
}

/**
 * Same asset class only, sorted by |vol - instrumentVol| ascending, ties by symbol.
 * Empty when the class is unknown/other, the volatility is missing, or nothing fits.
 */
export function similarProducts(
  instrumentClass: AssetClass | undefined,
  instrumentVol: number | undefined,
  candidates: SimilarCandidate[],
  n = SIMILAR_COUNT,
  exclude?: { symbol: string; isin?: string },
): { benchmark: Benchmark; vol: number }[] {
  if (!instrumentClass || instrumentClass === 'unknown' || instrumentClass === 'other') return [];
  if (instrumentVol === undefined || !Number.isFinite(instrumentVol)) return [];
  const sym = exclude?.symbol.toUpperCase();
  const isin = exclude?.isin?.toUpperCase();
  return candidates
    .filter((c): c is { benchmark: Benchmark; vol: number } => c.vol !== undefined && Number.isFinite(c.vol))
    .filter((c) => c.benchmark.assetClass === instrumentClass)
    .filter((c) => c.benchmark.symbol.toUpperCase() !== sym && !(isin && c.benchmark.isin.toUpperCase() === isin))
    .sort(
      (a, b) =>
        Math.abs(a.vol - instrumentVol) - Math.abs(b.vol - instrumentVol) ||
        a.benchmark.symbol.localeCompare(b.benchmark.symbol),
    )
    .slice(0, Math.max(0, n));
}

export interface Period {
  from: string;
  to: string;
}

export interface FundPeriods {
  full?: Period;
  year?: Period;
}

/** The dates the euro box simulates for a series: whole series and last 12 months (nearest available points). */
export function fundPeriods(prices: PricePoint[]): FundPeriods {
  const full = simulate({ amount: 1, prices });
  const year = simulate({ amount: 1, prices, from: lastYearStart(prices) });
  return {
    full: full && { from: full.startDate, to: full.endDate },
    year: year && { from: year.startDate, to: year.endDate },
  };
}

const DAY = 24 * 3600 * 1000;
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z');
const TOLERANCE_DAYS = 7;

/**
 * Close(end)/close(start) over the same dates as the fund's period, using the nearest points.
 * Undefined when the product has no data within a week of either date: the period is omitted, never shortened.
 */
export function growthRatio(prices: PricePoint[], period: Period | undefined): number | undefined {
  if (!period) return undefined;
  const r = simulate({ amount: 1, prices, from: period.from, to: period.to });
  if (!r) return undefined;
  const near = (a: string, b: string) => Math.abs(toMs(a) - toMs(b)) <= TOLERANCE_DAYS * DAY;
  if (!near(r.startDate, period.from) || !near(r.endDate, period.to)) return undefined;
  return r.end / r.start;
}

/** A similar product as sent to the client: facts plus the growth ratios; the client applies amount and fees. */
export interface SimilarItem {
  symbol: string;
  isin: string;
  name: string;
  ter: number;
  vol: number;
  distribution: 'acc' | 'dist';
  entryFee?: number;
  exitFee?: number;
  growth: { full?: number; year?: number };
}
