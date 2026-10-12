import type { AssetClass, InstrumentType } from '../data/types';

export type TaxCountry = 'IT' | 'ES' | 'DE' | 'FR' | 'UK' | 'OTHER';

export interface TaxInput {
  /** Final result minus amount invested, EUR (negative for a loss) */
  gain: number;
  type: InstrumentType;
  assetClass?: AssetClass;
  /** Government-bond share 0..1 when known */
  govtShare?: number;
  /** Distributing product: dividends are already part of the gain */
  distributing?: boolean;
}

export interface TaxEstimate {
  /** Tax in euros; low = high when the rule gives a single figure */
  low: number;
  high: number;
  /** Short Italian description of the rule used */
  rateLabel: string;
  notes: string[];
}

export interface TaxRules {
  estimate(input: TaxInput): TaxEstimate;
}
