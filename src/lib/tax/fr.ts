import type { TaxEstimate, TaxInput } from './types';
import { DIST_TAX_NOTE } from './it';
import { pctText } from './common';

// FLAG FOR REVIEW: simplified rules, to be checked by a person (reviewed: false).
// The 31,4% PFU (12,8% income tax + 18,6% social charges) assumes the 2026 social-charge increase.
export const FR_RATE = 0.314;

export function estimateFrTax({ gain, distributing }: TaxInput): TaxEstimate {
  const t = (gain > 0 ? gain : 0) * FR_RATE;
  const notes = ['PEA e assurance-vie non considerati.'];
  if (distributing) notes.push(DIST_TAX_NOTE);
  return {
    low: t,
    high: t,
    rateLabel: `Francia, PFU dal 2026: aliquota unica ${pctText(FR_RATE)} (12,8% imposta sul reddito + 18,6% contributi sociali)`,
    notes,
  };
}
