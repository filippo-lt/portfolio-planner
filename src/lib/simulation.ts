/** Isomorphic and pure: "what do I take home?" simulation in euros. Prices are adjusted closes, already net of TER. */
import type { DividendEvent, PricePoint } from './data/types';
import { parseItDecimal } from './profileValidation';
import { rateOnOrBefore, type FxRate } from './fx';

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
  /**
   * Distributing products only: non-adjusted closes (same dates as `prices`) and the per-share payments.
   * Both are needed; without them the adjusted path (payments reinvested) is used.
   */
  rawPrices?: PricePoint[];
  dividends?: DividendEvent[];
  /**
   * Non-EUR product: `rates` are units of the quote currency per 1 EUR (dated, ascending), `cost` the spread per conversion (fraction).
   * Without a rate near the start or end date the result stays unconverted (`fx` undefined in the result).
   */
  fx?: { rates: FxRate[]; cost: number };
}

/** Conversion applied to a result: EUR -> currency at the start, currency -> EUR at the end. */
export interface FxApplied {
  startRate: number;
  startRateDate: string;
  endRate: number;
  endRateDate: string;
  cost: number;
  /** Net value converted at the rates without the spread minus the net value with it */
  costEur: number;
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
  /** Cash received as coupons/dividends, not reinvested. Set only when simulated on raw prices (distributing). */
  dividendsEur?: number;
  distribution?: 'acc' | 'dist';
  /** Set when the amounts above are converted through the quote currency */
  fx?: FxApplied;
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

const feeOrUndefined = (f: number | undefined) => (f !== undefined && Number.isFinite(f) && f >= 0 ? f : undefined);

/**
 * Growth by a price ratio (end/start): the entry fee reduces what is invested, the exit fee applies to the final value.
 * The one place this arithmetic lives; `simulate` and the similar-products rows both use it.
 */
export function applyGrowth(amount: number, ratio: number, entryFee?: number, exitFee?: number) {
  const entry = feeOrUndefined(entryFee);
  const exit = feeOrUndefined(exitFee);
  const entryFeeEur = amount * (entry ?? 0);
  const grossValue = (amount - entryFeeEur) * ratio;
  const exitFeeEur = grossValue * (exit ?? 0);
  const netValue = grossValue - exitFeeEur;
  return { entryFeeEur, grossValue, exitFeeEur, netValue, feesIncluded: { entry: entry !== undefined, exit: exit !== undefined } };
}

/**
 * Invests `amount` at the start price. The entry fee reduces what is invested; the exit fee applies to the final value.
 * The TER is NOT subtracted: adjusted prices already include it.
 * Undefined when the history does not reach back to `from` (within a week) or covers less than two points.
 */
export function simulate({ amount, prices, from, to, entryFee, exitFee, rawPrices, dividends, fx }: SimInput): SimResult | undefined {
  if (!Number.isFinite(amount) || amount <= 0 || prices.length < 2) return undefined;
  if (from && toMs(prices[0].date) > toMs(from) + 7 * DAY) return undefined;
  const s = from ? nearest(prices, from) : prices[0];
  const e = to ? nearest(prices, to) : prices[prices.length - 1];
  if (!(s.close > 0) || !(e.close > 0) || toMs(e.date) <= toMs(s.date)) return undefined;
  const adjusted = applyGrowth(amount, e.close / s.close, entryFee, exitFee);
  const { entryFeeEur, feesIncluded } = adjusted;
  const invested = amount - entryFeeEur;
  // Distributing: price change on the raw closes, plus the payments received in cash (ex-date after start, up to end).
  const rs = rawPrices && dividends ? rawPrices.find((p) => p.date === s.date) : undefined;
  const re = rawPrices && dividends ? rawPrices.find((p) => p.date === e.date) : undefined;
  const dist = rs && re && rs.close > 0 && re.close > 0 ? { shares: invested / rs.close, end: re.close } : undefined;
  const grossValue = dist ? dist.shares * dist.end : adjusted.grossValue;
  const dividendsEur = dist
    ? dist.shares * (dividends ?? []).filter((d) => d.date > s.date && d.date <= e.date).reduce((t, d) => t + d.amount, 0)
    : undefined;
  const exitFee0 = grossValue * (feeOrUndefined(exitFee) ?? 0);
  const net0 = grossValue - exitFee0 + (dividendsEur ?? 0);
  // Currency conversion: growth is a ratio, so the EUR result is the EUR-like one times rate(start)/rate(end), less the spread twice.
  // Dividends are received in the quote currency and converted at the end rate (simplification).
  const rs0 = fx ? rateOnOrBefore(fx.rates, s.date) : undefined;
  const re0 = fx ? rateOnOrBefore(fx.rates, e.date) : undefined;
  const spread = fx && Number.isFinite(fx.cost) && fx.cost >= 0 && fx.cost < 1 ? fx.cost : 0;
  const m0 = rs0 && re0 ? rs0.close / re0.close : 1;
  const m = m0 * (1 - spread) ** 2;
  const converted = rs0 && re0 ? { startRate: rs0.close, startRateDate: rs0.rateDate ?? rs0.date, endRate: re0.close, endRateDate: re0.rateDate ?? re0.date, cost: spread, costEur: net0 * (m0 - m) } : undefined;
  // Gross, exit fee and dividends move with the exchange rate only; the spread is shown once, as costEur, so net = gross - exit fee + dividends - costEur.
  const k = converted ? m0 : 1;
  const exitFeeEur = exitFee0 * k;
  const netValue = net0 * (converted ? m : 1);
  return {
    start: s.close,
    end: e.close,
    startDate: s.date,
    endDate: e.date,
    years: (toMs(e.date) - toMs(s.date)) / (365.25 * DAY),
    grossValue: grossValue * k,
    entryFeeEur,
    exitFeeEur,
    netValue,
    gainEur: netValue - amount,
    feesIncluded,
    ...(dist ? { dividendsEur: dividendsEur! * k, distribution: 'dist' as const } : {}),
    ...(converted ? { fx: converted } : {}),
  };
}

/** Informational only: what the TER took over `years`. Already inside the price, never subtracted again. */
export function terCostEstimate(amount: number, ter: number | undefined, years: number): number | undefined {
  if (ter === undefined || !Number.isFinite(ter) || !Number.isFinite(amount) || !Number.isFinite(years) || years <= 0) return undefined;
  return amount * ter * years;
}
