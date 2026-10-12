import type { InstrumentProfile, PricePoint, SymbolCandidate } from './types';

export interface DataProvider {
  /** Resolve a free-text query, ticker or ISIN to candidate symbols (EUR listings first). */
  resolve(query: string): Promise<SymbolCandidate[]>;
  getProfile(symbol: string): Promise<InstrumentProfile>;
  getHistory(symbol: string, years: number): Promise<PricePoint[]>;
}
