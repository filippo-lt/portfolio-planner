export type InstrumentType = 'ETF' | 'FUND' | 'STOCK';

export type AssetClass = 'equity' | 'bond' | 'mixed' | 'other' | 'unknown';

export interface Holding {
  symbol?: string;
  name: string;
  /** Fraction 0..1 */
  weight: number;
}

export interface Allocation {
  name: string;
  /** Fraction 0..1 */
  weight: number;
}

export interface Fundamentals {
  revenue?: number;
  netIncome?: number;
  totalDebt?: number;
  freeCashFlow?: number;
  fiscalYear?: number;
  /** Currency of the financial statements, when known */
  currency?: string;
}

/** A one-off or performance fee as a fraction (0.01 = 1%) with where the number comes from. */
export interface FeeValue {
  value: number;
  source: 'kid' | 'manual' | 'user';
}

export interface InstrumentProfile {
  symbol: string;
  name: string;
  type: InstrumentType;
  currency: string;
  exchange: string;
  isin?: string;
  /** Ongoing charges as a fraction (0.0022 = 0.22%) */
  ter?: number;
  entryFee?: FeeValue;
  exitFee?: FeeValue;
  performanceFee?: FeeValue;
  holdings?: Holding[];
  sectors?: Allocation[];
  countries?: Allocation[];
  /** Company sector (stocks), plain label */
  sector?: string;
  /** Company country (stocks), plain label */
  country?: string;
  fundamentals?: Fundamentals;
  assetClass?: AssetClass;
  /** Short Italian reason for the asset class, e.g. "Categoria Yahoo: EUR Diversified Bond" */
  assetClassReason?: string;
  /** Accumulating or distributing share class; undefined when neither the curated list nor the name says */
  distribution?: 'acc' | 'dist';
}

export interface PricePoint {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Adjusted close */
  close: number;
}

/** A cash payment per share (coupon or dividend), in the product's currency. */
export interface DividendEvent {
  /** ISO date YYYY-MM-DD of the ex-date */
  date: string;
  amount: number;
}

export interface SymbolCandidate {
  symbol: string;
  name: string;
  type: InstrumentType;
  exchange: string;
  currency?: string;
  isin?: string;
}
