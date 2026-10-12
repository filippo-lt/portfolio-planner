/** Isomorphic and pure: "what do I take home?" simulation in euros. Prices are adjusted closes, already net of TER. */
import type { PricePoint } from './data/types';
import { parseItDecimal } from './profileValidation';

export const DEFAULT_SIM_AMOUNT = 1000;
export const MAX_SIM_AMOUNT = 10_000_000;

const DAY = 24 * 3600 * 1000;
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z');

/** Amount typed in Italian ("1.000" or "1000"): positive and at most 10 million, else undefined. */
export function parseSimAmount(raw: string): number | undefined {
  const v = parseItDecimal(raw);
  return Number.isFinite(v) && v > 0 && v <= MAX_SIM_AMOUNT ? v : undefined;
}

export interface SimInput {
  amount: number;
  prices: PricePoint[];
  /** ISO date; the nearest available point is used. Default: first price. */
  from?: string;
  /** ISO date; the nearest available point is used. Default: last price. */
  to?: string;
  /** Fractions (0.01 = 1%); missing means "not included", never estimated. */
  entryFee?: number;
  exitFee?: number;
}

export interface SimResult {
  start: number;
  end: number;
  startDate: string;
  endDate: string;
  years: number;
  /** Value of the amount left after the entry fee, grown with the price. */
  grossValue: number;
  entryFeeEur: number;
  exitFeeEur: number;
  netValue: number;
  gainEur: number;
  feesIncluded: { entry: boolean; exit: boolean };
}

function nearest(prices: PricePoint[], date: string): PricePoint {
  const t = toMs(date);
  let best = prices[0];
  for (const p of prices) if (Math.abs(toMs(p.date) - t) < Math.abs(toMs(best.date) - t)) best = p;
  return best;
}

/** Date 365 days before the last price: the "last 12 months" start. Undefined without prices. */
export function lastYearStart(prices: PricePoint[]): string | undefined {
  const last = prices[prices.length - 1];
  return last ? new Date(toMs(last.date) - 365 * DAY).toISOString().slice(0, 10) : undefined;
}

/**
 * Invests `amount` at the start price. The entry fee reduces what is invested; the exit fee applies to the final value.
 * The TER is NOT subtracted: adjusted prices already include it.
 * Undefined when the history does not reach back to `from` (within a week) or covers less than two points.
 */
export function simulate({ amount, prices, from, to, entryFee, exitFee }: SimInput): SimResult | undefined {
  if (!Number.isFinite(amount) || amount <= 0 || prices.length < 2) return undefined;
  if (from && toMs(prices[0].date) > toMs(from) + 7 * DAY) return undefined;
  const s = from ? nearest(prices, from) : prices[0];
  const e = to ? nearest(prices, to) : prices[prices.length - 1];
  if (!(s.close > 0) || !(e.close > 0) || toMs(e.date) <= toMs(s.date)) return undefined;
  const entry = entryFee !== undefined && Number.isFinite(entryFee) && entryFee >= 0 ? entryFee : undefined;
  const exit = exitFee !== undefined && Number.isFinite(exitFee) && exitFee >= 0 ? exitFee : undefined;
  const entryFeeEur = amount * (entry ?? 0);
  const grossValue = ((amount - entryFeeEur) * e.close) / s.close;
  const exitFeeEur = grossValue * (exit ?? 0);
  const netValue = grossValue - exitFeeEur;
  return {
    start: s.close,
    end: e.close,
    startDate: s.date,
    endDate: e.date,
    years: (toMs(e.date) - toMs(s.date)) / (365.25 * DAY),
    grossValue,
    entryFeeEur,
    exitFeeEur,
    netValue,
    gainEur: netValue - amount,
    feesIncluded: { entry: entry !== undefined, exit: exit !== undefined },
  };
}

/** Informational only: what the TER took over `years`. Already inside the price, never subtracted again. */
export function terCostEstimate(amount: number, ter: number | undefined, years: number): number | undefined {
  if (ter === undefined || !Number.isFinite(ter) || !Number.isFinite(amount) || !Number.isFinite(years) || years <= 0) return undefined;
  return amount * ter * years;
}
