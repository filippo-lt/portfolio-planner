import type { PricePoint } from './data/types';

const DAY = 24 * 3600 * 1000;
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z');

/** CAGR from the price `years` ago to the last price. Undefined if history is too short. */
export function annualizedReturn(prices: PricePoint[], years: number): number | undefined {
  if (prices.length < 2 || years <= 0) return undefined;
  const last = prices[prices.length - 1];
  const target = toMs(last.date) - years * 365.25 * DAY;
  // history must reach back to (about) the target date
  if (toMs(prices[0].date) > target + 7 * DAY) return undefined;
  let start: PricePoint | undefined;
  for (const p of prices) {
    if (toMs(p.date) <= target) start = p;
    else break;
  }
  start ??= prices[0];
  if (start.close <= 0 || last.close <= 0) return undefined;
  // use the actual elapsed span, not the nominal one
  const elapsed = (toMs(last.date) - toMs(start.date)) / (365.25 * DAY);
  if (elapsed <= 0) return undefined;
  return Math.pow(last.close / start.close, 1 / elapsed) - 1;
}

export interface Volatility {
  value: number;
  /** Years of history actually used (max 3) */
  years: number;
}

/** Std dev of daily simple returns × √252 over the last 3 years (or what is available). */
export function annualizedVolatility(prices: PricePoint[], maxYears = 3): number | undefined {
  return annualizedVolatilityDetail(prices, maxYears)?.value;
}

export function annualizedVolatilityDetail(prices: PricePoint[], maxYears = 3): Volatility | undefined {
  if (prices.length < 3) return undefined;
  const lastMs = toMs(prices[prices.length - 1].date);
  const cutoff = lastMs - maxYears * 365.25 * DAY;
  const window = prices.filter((p) => toMs(p.date) >= cutoff);
  if (window.length < 22) return undefined;
  const rets: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1].close > 0) rets.push(window[i].close / window[i - 1].close - 1);
  }
  if (rets.length < 21) return undefined;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const years = (lastMs - toMs(window[0].date)) / (365.25 * DAY);
  return { value: Math.sqrt(variance) * Math.sqrt(252), years };
}

export interface Drawdown {
  /** Negative fraction (-0.34 = -34%), 0 if never below a previous peak */
  value: number;
  peakDate?: string;
  troughDate?: string;
}

export function maxDrawdown(prices: PricePoint[]): Drawdown | undefined {
  if (prices.length < 2) return undefined;
  let peak = prices[0];
  let best: Drawdown = { value: 0 };
  for (const p of prices) {
    if (p.close > peak.close) peak = p;
    const dd = peak.close > 0 ? p.close / peak.close - 1 : 0;
    if (dd < best.value) best = { value: dd, peakDate: peak.date, troughDate: p.date };
  }
  return best;
}

export interface RebasedPoint {
  date: string;
  a: number;
  b: number;
}

/** Aligns two series on their common dates and rebases both to 100 at the first common date. */
export function rebase(a: PricePoint[], b: PricePoint[]): RebasedPoint[] {
  const bMap = new Map(b.map((p) => [p.date, p.close]));
  const common = a.filter((p) => bMap.has(p.date));
  if (common.length === 0) return [];
  const a0 = common[0].close;
  const b0 = bMap.get(common[0].date)!;
  if (!(a0 > 0) || !(b0 > 0)) return [];
  return common.map((p) => ({
    date: p.date,
    a: (p.close / a0) * 100,
    b: (bMap.get(p.date)! / b0) * 100,
  }));
}

/** First price plus the last close of each calendar month (and the final point). */
export function monthlyCloses(prices: PricePoint[]): PricePoint[] {
  if (prices.length === 0) return [];
  const out: PricePoint[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    const isMonthEnd = prices[i].date.slice(0, 7) !== prices[i + 1]?.date.slice(0, 7);
    if (isMonthEnd) out.push(prices[i]);
  }
  return out.filter((p, i, a) => i === 0 || p.date !== a[i - 1].date);
}

/** Years spanned by a series (first to last date). */
export function spanYears(series: PricePoint[]): number {
  if (series.length < 2) return 0;
  return (toMs(series[series.length - 1].date) - toMs(series[0].date)) / (365.25 * DAY);
}

export interface RollingRange {
  windowYears: number;
  /** Worst / best annualized return over rolling windows (fractions) */
  worst: number;
  best: number;
  count: number;
}

/**
 * Worst and best annualized return over rolling windows of `horizonYears`,
 * computed on (monthly) closes. Undefined if the history is shorter than the horizon.
 */
export function rollingReturnRange(series: PricePoint[], horizonYears: number): RollingRange | undefined {
  if (series.length < 2 || horizonYears <= 0) return undefined;
  if (spanYears(series) < horizonYears) return undefined;
  const slackMs = 16 * DAY; // month-end sampling tolerance
  let worst = Infinity;
  let best = -Infinity;
  let count = 0;
  let j = 0;
  for (let i = 0; i < series.length; i++) {
    const target = toMs(series[i].date) + horizonYears * 365.25 * DAY - slackMs;
    if (j < i) j = i;
    while (j < series.length && toMs(series[j].date) < target) j++;
    if (j >= series.length) break;
    const a = series[i];
    const b = series[j];
    const yrs = (toMs(b.date) - toMs(a.date)) / (365.25 * DAY);
    if (a.close <= 0 || b.close <= 0 || yrs <= 0) continue;
    const r = Math.pow(b.close / a.close, 1 / yrs) - 1;
    worst = Math.min(worst, r);
    best = Math.max(best, r);
    count++;
  }
  if (count === 0) return undefined;
  return { windowYears: horizonYears, worst, best, count };
}
