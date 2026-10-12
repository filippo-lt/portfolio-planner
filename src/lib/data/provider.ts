import type { DividendEvent, InstrumentProfile, PricePoint, SymbolCandidate } from './types';

export interface DataProvider {
  /** Resolve a free-text query, ticker or ISIN to candidate symbols (EUR listings first). */
  resolve(query: string): Promise<SymbolCandidate[]>;
  getProfile(symbol: string): Promise<InstrumentProfile>;
  getHistory(symbol: string, years: number): Promise<PricePoint[]>;
  /** Non-adjusted closes: the real price paid, before coupons/dividends are folded in. */
  getRawHistory(symbol: string, years: number): Promise<PricePoint[]>;
  /** Cash payments per share over the last `years`; empty when the source has none. */
  getDividends(symbol: string, years: number): Promise<DividendEvent[]>;
}
