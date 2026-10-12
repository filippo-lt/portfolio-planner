import type { TaxEstimate, TaxInput } from './types';
import { DIST_TAX_NOTE } from './it';
import { eurText, pctText } from './common';

// Simplified rules, to be reviewed by a person (reviewed: false). Savings-income brackets.
/** Upper bound of each bracket (EUR) and its rate */
export const ES_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 6_000, rate: 0.19 },
  { upTo: 50_000, rate: 0.21 },
  { upTo: 200_000, rate: 0.23 },
  { upTo: 300_000, rate: 0.27 },
  { upTo: Infinity, rate: 0.3 },
];

function progressive(gain: number): number {
  let tax = 0;
  let from = 0;
  for (const b of ES_BRACKETS) {
    if (gain <= from) break;
    tax += (Math.min(gain, b.upTo) - from) * b.rate;
    from = b.upTo;
  }
  return tax;
}

export function estimateEsTax({ gain, distributing }: TaxInput): TaxEstimate {
  const tax = gain > 0 ? progressive(gain) : 0;
  const label = ES_BRACKETS.map((b, i) => {
    const prev = i === 0 ? 0 : ES_BRACKETS[i - 1].upTo;
    return b.upTo === Infinity ? `${pctText(b.rate)} oltre ${eurText(prev)}` : `${pctText(b.rate)} fino a ${eurText(b.upTo)}`;
  }).join(', ');
  const notes = [
    'Calcolato come se fosse l\'unico reddito da risparmio dell\'anno.',
    'Le minusvalenze possono compensare le plusvalenze: non considerato.',
  ];
  if (distributing) notes.push(DIST_TAX_NOTE);
  return { low: tax, high: tax, rateLabel: `Spagna, scaglioni sul reddito da risparmio: ${label}`, notes };
}
