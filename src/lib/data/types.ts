export type InstrumentType = 'ETF' | 'FUND' | 'STOCK';

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

export interface InstrumentProfile {
  symbol: string;
  name: string;
  type: InstrumentType;
  currency: string;
  exchange: string;
  isin?: string;
  /** Ongoing charges as a fraction (0.0022 = 0.22%) */
  ter?: number;
  holdings?: Holding[];
  sectors?: Allocation[];
  countries?: Allocation[];
  /** Company sector (stocks), plain label */
  sector?: string;
  /** Company country (stocks), plain label */
  country?: string;
  fundamentals?: Fundamentals;
}

export interface PricePoint {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Adjusted close */
  close: number;
}

export interface SymbolCandidate {
  symbol: string;
  name: string;
  type: InstrumentType;
  exchange: string;
  currency?: string;
  isin?: string;
}
