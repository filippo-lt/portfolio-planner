import type { InvestorProfile, Knowledge } from './profileFit';
import { isTaxCountry } from './tax';
import type { TaxCountry } from './tax/types';

export interface ProfileErrors {
  [field: string]: string | undefined;
}

export interface ProfileForm {
  age: string;
  horizonYears: string;
  retirementAge: string;
  netWorthEur: string;
  maxDrawdownPct: string;
  knowledge: Knowledge | '';
  /** Empty means not set */
  taxCountry?: TaxCountry | '';
}

const INT_RE = /^\d{1,3}$/;
const DECIMAL_RE = /^\d{1,12}([.,]\d{1,4})?$/;
// Italian thousands grouping: "50.000", "1.234.567,89"
const GROUPED_RE = /^\d{1,3}(\.\d{3})+(,\d{1,4})?$/;

const int = (s: string) => (INT_RE.test(s.trim()) ? Number(s.trim()) : NaN);
/** Accepts "50000", "50.000", "1.234,5", "12.5", "12,5"; ignores spaces, € and %. */
export function parseItDecimal(raw: string): number {
  const s = raw.replace(/[\s€%]/g, '');
  if (GROUPED_RE.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  return DECIMAL_RE.test(s) ? Number(s.replace(',', '.')) : NaN;
}
const dec = parseItDecimal;

export function validateProfile(f: ProfileForm): { profile?: InvestorProfile; errors: ProfileErrors } {
  const errors: ProfileErrors = {};
  const age = int(f.age);
  const horizon = int(f.horizonYears);
  const retire = int(f.retirementAge);
  const worth = dec(f.netWorthEur);
  const dd = dec(f.maxDrawdownPct);
  if (!Number.isFinite(age) || age < 18 || age > 100) errors.age = "Inserisci un'età intera tra 18 e 100.";
  if (!Number.isFinite(horizon) || horizon < 1 || horizon > 80)
    errors.horizonYears = 'Inserisci un numero intero di anni tra 1 e 80.';
  if (!Number.isFinite(retire) || retire < 30 || retire > 100)
    errors.retirementAge = "Inserisci un'età intera tra 30 e 100.";
  else if (!errors.age && retire < age)
    errors.retirementAge = "L'età di pensionamento non può essere inferiore all'età attuale.";
  if (!Number.isFinite(worth) || worth > 1e10)
    errors.netWorthEur = 'Inserisci un importo in euro maggiore o uguale a 0 (solo cifre).';
  if (!Number.isFinite(dd) || dd < 1 || dd > 99)
    errors.maxDrawdownPct = 'Inserisci una percentuale tra 1 e 99 (solo cifre).';
  if (!f.knowledge) errors.knowledge = 'Seleziona un livello.';
  if (f.taxCountry && !isTaxCountry(f.taxCountry)) errors.taxCountry = "Seleziona un paese dall'elenco.";
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    profile: {
      age,
      horizonYears: horizon,
      retirementAge: retire,
      netWorthEur: worth,
      maxDrawdownPct: dd,
      knowledge: f.knowledge as Knowledge,
      ...(f.taxCountry ? { taxCountry: f.taxCountry } : {}),
    },
  };
}

/** Non-blocking notes: the user's choice always wins. */
export function profileWarnings(f: ProfileForm): string[] {
  const age = int(f.age);
  const horizon = int(f.horizonYears);
  const retire = int(f.retirementAge);
  const out: string[] = [];
  if (
    Number.isFinite(age) &&
    Number.isFinite(horizon) &&
    Number.isFinite(retire) &&
    retire > age &&
    horizon > retire - age
  ) {
    out.push(
      `L'orizzonte indicato (${horizon} anni) è maggiore degli anni che mancano all'età di pensionamento indicata (${retire - age}). Il profilo può essere salvato comunque.`,
    );
  }
  return out;
}
