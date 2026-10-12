import type { TaxEstimate, TaxInput } from './types';
import { DIST_TAX_NOTE } from './it';
import { pctText } from './common';

// Simplified rules, to be reviewed by a person (reviewed: false).
/** 25% Abgeltungsteuer + 5,5% Solidaritätszuschlag on it */
export const DE_RATE = 0.25 * 1.055;

/** Share of the gain exempt (Teilfreistellung) by asset class; shares are for funds held by private investors */
const EXEMPT = { equity: 0.3, mixed: 0.15, none: 0 };

export function estimateDeTax({ gain, type, assetClass, distributing }: TaxInput): TaxEstimate {
  const taxable = gain > 0 ? gain : 0;
  let exemptLow: number; // lowest exempt share (-> highest tax)
  let exemptHigh: number;
  let how: string;
  if (type === 'STOCK') {
    exemptLow = exemptHigh = EXEMPT.none;
    how = 'nessuna esenzione parziale per le azioni singole';
  } else if (assetClass === 'equity') {
    exemptLow = exemptHigh = EXEMPT.equity;
    how = 'esenzione parziale (Teilfreistellung) del 30% per i fondi azionari';
  } else if (assetClass === 'mixed') {
    exemptLow = exemptHigh = EXEMPT.mixed;
    how = 'esenzione parziale (Teilfreistellung) del 15% per i fondi misti';
  } else if (assetClass === 'bond' || assetClass === 'other') {
    exemptLow = exemptHigh = EXEMPT.none;
    how = 'nessuna esenzione parziale per questa categoria';
  } else {
    exemptLow = EXEMPT.none;
    exemptHigh = EXEMPT.equity;
    how = 'esenzione parziale (Teilfreistellung) tra 0% e 30% a seconda della categoria, non nota';
  }
  const high = taxable * DE_RATE * (1 - exemptLow);
  const low = taxable * DE_RATE * (1 - exemptHigh);
  const rateLabel = `Germania, aliquota ${pctText(DE_RATE)} (25% + 5,5% di Solidaritätszuschlag) sul guadagno, ${how}`;
  const notes = [
    'Franchigia Sparer-Pauschbetrag (1.000 €) e Vorabpauschale non inclusi.',
    'Imposta ecclesiastica (Kirchensteuer) non inclusa.',
  ];
  if (distributing) notes.push(DIST_TAX_NOTE);
  return { low, high, rateLabel, notes };
}
