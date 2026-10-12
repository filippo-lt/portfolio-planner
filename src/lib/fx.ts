/** Isomorphic and pure: currency-conversion helpers. Rates are "units of currency C per 1 EUR" (Yahoo `EUR${C}=X`). */
import type { PricePoint } from './data/types';
import { parseItDecimal } from './profileValidation';

/** Typical broker spread per conversion, as a fraction (0.0025 = 0,25%). */
export const DEFAULT_FX_COST = 0.0025;
export const MAX_FX_COST = 0.05;
/** A rate is used only when it is at most this old compared with the date it serves. */
export const FX_TOLERANCE_DAYS = 7;

const DAY = 24 * 3600 * 1000;
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z');

/** Yahoo symbol with the currency per 1 EUR; pence (GBp/GBX) use the pound rate. Undefined for EUR or an unusable code. */
export function fxSymbol(currency: string | undefined): string | undefined {
  if (!currency) return undefined;
  const c = currency === 'GBp' || currency === 'GBX' ? 'GBP' : currency.toUpperCase();
  return /^[A-Z]{3}$/.test(c) && c !== 'EUR' ? `EUR${c}=X` : undefined;
}

/** Latest rate on or before `date`, at most FX_TOLERANCE_DAYS old; undefined otherwise (never estimated). `rates` ascending by date. */
export function rateOnOrBefore(rates: PricePoint[], date: string): PricePoint | undefined {
  const t = toMs(date);
  let best: PricePoint | undefined;
  for (const r of rates) {
    if (toMs(r.date) > t) break;
    if (r.close > 0) best = r;
  }
  return best && t - toMs(best.date) <= FX_TOLERANCE_DAYS * DAY ? best : undefined;
}

/** Rates reduced to the given dates (the rate valid on each, dates without one are left out), to keep the payload small. */
export function alignRates(rates: PricePoint[], dates: string[]): PricePoint[] {
  const out: PricePoint[] = [];
  for (const date of dates) {
    const r = rateOnOrBefore(rates, date);
    if (r) out.push({ date, close: r.close });
  }
  return out;
}

/** FX cost typed as a percentage in Italian ("0,25"): 0 to 5%, returned as a fraction; undefined when invalid. */
export function parseFxCost(raw: string): number | undefined {
  const v = parseItDecimal(raw);
  return Number.isFinite(v) && v >= 0 && v <= MAX_FX_COST * 100 ? v / 100 : undefined;
}
