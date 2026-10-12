import { estimateDeTax } from './de';
import { estimateEsTax } from './es';
import { estimateFrTax } from './fr';
import { estimateItTax } from './it';
import { estimateUkTax } from './uk';
import type { TaxCountry, TaxRules } from './types';

export type { TaxCountry, TaxEstimate, TaxInput, TaxRules } from './types';

export const TAX_COUNTRIES: { value: TaxCountry; label: string }[] = [
  { value: 'IT', label: 'Italia' },
  { value: 'ES', label: 'Spagna' },
  { value: 'DE', label: 'Germania' },
  { value: 'FR', label: 'Francia' },
  { value: 'UK', label: 'Regno Unito' },
  { value: 'OTHER', label: 'Altro paese' },
];

export const isTaxCountry = (v: unknown): v is TaxCountry => TAX_COUNTRIES.some((c) => c.value === v);

const RULES: Partial<Record<TaxCountry, TaxRules>> = {
  IT: { estimate: estimateItTax },
  ES: { estimate: estimateEsTax },
  DE: { estimate: estimateDeTax },
  FR: { estimate: estimateFrTax },
  UK: { estimate: estimateUkTax },
};

/** Undefined when the country has no rules yet: callers show "Tasse non incluse". */
export const taxRulesFor = (country: TaxCountry | undefined): TaxRules | undefined => (country ? RULES[country] : undefined);
