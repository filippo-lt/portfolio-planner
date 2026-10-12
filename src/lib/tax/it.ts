import type { AssetClass, InstrumentType } from '../data/types';
import type { TaxEstimate, TaxInput } from './types';

export const IT_RATE_GOVT = 0.125;
export const IT_RATE_STANDARD = 0.26;

const CAPITAL_INCOME_NOTE = 'Per ETF e fondi i guadagni sono redditi di capitale: le perdite non possono compensarli.';
export const DIST_TAX_NOTE =
  'Per i prodotti a distribuzione le cedole sono tassate quando incassate: qui sono incluse nel guadagno finale per semplicità.';

const pctText = (r: number) => `${(r * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;

/** Rate range for a class; low = high when the rule is a single rate. */
function rates(
  type: InstrumentType,
  assetClass: AssetClass | undefined,
  govtShare: number | undefined,
): { low: number; high: number; label: string } {
  if (type === 'STOCK' || assetClass === 'equity' || assetClass === 'other') {
    return {
      low: IT_RATE_STANDARD,
      high: IT_RATE_STANDARD,
      label: `aliquota ${pctText(IT_RATE_STANDARD)} sul guadagno`,
    };
  }
  if (
    (assetClass === 'bond' || assetClass === 'mixed') &&
    govtShare !== undefined &&
    govtShare >= 0 &&
    govtShare <= 1
  ) {
    const r = IT_RATE_GOVT * govtShare + IT_RATE_STANDARD * (1 - govtShare);
    return {
      low: r,
      high: r,
      label: `aliquota effettiva ${pctText(r)} (${pctText(IT_RATE_GOVT)} sulla quota in titoli di Stato, ${pctText(IT_RATE_STANDARD)} sul resto; quota titoli di Stato ${pctText(govtShare)})`,
    };
  }
  return {
    low: IT_RATE_GOVT,
    high: IT_RATE_STANDARD,
    label: `da ${pctText(IT_RATE_GOVT)} a ${pctText(IT_RATE_STANDARD)} a seconda della quota in titoli di Stato, non nota`,
  };
}

/** Italian tax on the final result: only a positive gain is taxed. Estimate, not tax advice. */
export function estimateItTax({ gain, type, assetClass, govtShare, distributing }: TaxInput): TaxEstimate {
  const r = rates(type, assetClass, govtShare);
  const taxable = gain > 0 ? gain : 0;
  const notes: string[] = [];
  if (type !== 'STOCK') notes.push(CAPITAL_INCOME_NOTE);
  if (distributing) notes.push(DIST_TAX_NOTE);
  return { low: taxable * r.low, high: taxable * r.high, rateLabel: r.label, notes };
}
