/** Isomorphic and pure: hand-made fee data applied on top of the provider profile. */
import { BENCHMARKS } from '../benchmarks';
import type { FeeValue, InstrumentProfile } from './types';

export interface CostOverride {
  /** Match by symbol and/or ISIN (either is enough) */
  symbol?: string;
  isin?: string;
  entryFee?: FeeValue;
  exitFee?: FeeValue;
  performanceFee?: FeeValue;
  /** Hand-made; false until a person has checked it */
  reviewed: boolean;
}

// ETFs charge no entry/exit fee at fund level. No guessed values for funds.
export const COST_OVERRIDES: CostOverride[] = BENCHMARKS.map((b) => ({
  symbol: b.symbol,
  isin: b.isin,
  entryFee: { value: 0, source: 'manual' as const },
  exitFee: { value: 0, source: 'manual' as const },
  reviewed: false,
}));

export function findCostOverride(p: Pick<InstrumentProfile, 'symbol' | 'isin'>): CostOverride | undefined {
  const sym = p.symbol.toUpperCase();
  const isin = p.isin?.toUpperCase();
  return COST_OVERRIDES.find((o) => (o.symbol && o.symbol.toUpperCase() === sym) || (o.isin && isin && o.isin.toUpperCase() === isin));
}

/** Fills missing fees from the table; fees already on the profile are kept. */
export function applyCostOverrides(profile: InstrumentProfile): InstrumentProfile {
  const o = findCostOverride(profile);
  if (!o) return profile;
  return {
    ...profile,
    entryFee: profile.entryFee ?? o.entryFee,
    exitFee: profile.exitFee ?? o.exitFee,
    performanceFee: profile.performanceFee ?? o.performanceFee,
  };
}
