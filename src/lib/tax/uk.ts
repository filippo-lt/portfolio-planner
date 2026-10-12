import type { TaxEstimate, TaxInput } from './types';
import { DIST_TAX_NOTE } from './it';

// Simplified rules, to be reviewed by a person (reviewed: false).
// The range is applied to the EUR gain as is: no GBP conversion.
export const UK_RATE_LOW = 0.18;
export const UK_RATE_HIGH = 0.24;

export function estimateUkTax({ gain, distributing }: TaxInput): TaxEstimate {
  const taxable = gain > 0 ? gain : 0;
  const notes = ["Annual exempt amount (£3.000) e fondi non 'reporting' non considerati."];
  if (distributing) notes.push(DIST_TAX_NOTE);
  return {
    low: taxable * UK_RATE_LOW,
    high: taxable * UK_RATE_HIGH,
    rateLabel: 'Regno Unito, Capital Gains Tax da 18% (aliquota base) a 24% (aliquota alta) sul guadagno',
    notes,
  };
}
