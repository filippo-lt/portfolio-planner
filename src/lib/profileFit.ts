/** Isomorphic and pure: safe to import from client components. */
import type { PricePoint } from './data/types';
import type { TaxCountry } from './tax/types';
import { rollingReturnRange, spanYears } from './metrics';

export type Knowledge = 'base' | 'intermedio' | 'avanzato';

export interface InvestorProfile {
  age: number;
  /** Investment horizon in years */
  horizonYears: number;
  retirementAge: number;
  /** Invested net worth, EUR (approximate) */
  netWorthEur: number;
  /** Max acceptable drawdown on the whole portfolio, positive percent (20 = -20%) */
  maxDrawdownPct: number;
  knowledge: Knowledge;
  /** Tax residence; optional, tax is not estimated without a supported country */
  taxCountry?: TaxCountry;
}

export interface FitInput {
  /** Negative fraction, e.g. -0.34 */
  maxDrawdown?: number;
  /** Fraction, e.g. 0.18 */
  volatility?: number;
  currency: string;
  /** Monthly closes (see monthlyCloses) for rolling-window comparison */
  monthly?: PricePoint[];
}

export type FitStatus = 'entro' | 'oltre' | 'info';

export interface FitStatement {
  id: 'drawdown' | 'volatility' | 'rolling' | 'currency';
  text: string;
  status: FitStatus;
}

export const STATUS_LABEL: Record<FitStatus, string> = {
  entro: 'entro la soglia che hai indicato',
  oltre: 'sopra la soglia che hai indicato',
  info: 'informazione',
};

export const NA = 'Dato non disponibile';

const pct = (v: number, digits = 0) =>
  `${(v * 100).toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

const it = (n: number, digits = 1) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: digits });

const points = (n: number) => `${it(n)} ${n === 1 ? 'punto' : 'punti'}`;

const BAND_RANGE = { breve: 'meno di 3 anni', medio: 'da 3 a 10 anni', lungo: 'oltre 10 anni' } as const;

export function horizonBand(years: number): 'breve' | 'medio' | 'lungo' {
  if (years < 3) return 'breve';
  if (years <= 10) return 'medio';
  return 'lungo';
}

export function profileFit(profile: InvestorProfile, m: FitInput): FitStatement[] {
  const out: FitStatement[] = [];

  // Drawdown vs tolerance
  if (m.maxDrawdown === undefined) {
    out.push({ id: 'drawdown', status: 'info', text: `Perdita massima storica: ${NA}.` });
  } else {
    // One decimal, as in the figure tile of the report
    const dd = Math.round(m.maxDrawdown * 1000) / 10;
    const ddText = dd.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const tol = -Math.abs(profile.maxDrawdownPct);
    const diff = Math.round(Math.abs(Math.abs(dd) - Math.abs(tol)) * 10) / 10;
    if (Math.abs(dd) > Math.abs(tol)) {
      out.push({
        id: 'drawdown',
        status: 'oltre',
        text: `La perdita massima storica (${ddText}%) supera la soglia indicata (${it(tol)}%) di ${points(diff)}. La soglia è riferita all'intero portafoglio.`,
      });
    } else {
      out.push({
        id: 'drawdown',
        status: 'entro',
        text:
          diff === 0
            ? `La perdita massima storica (${ddText}%) coincide con la soglia indicata (${it(tol)}%). La soglia è riferita all'intero portafoglio.`
            : `La perdita massima storica (${ddText}%) è inferiore alla soglia indicata (${it(tol)}%) di ${points(diff)}. La soglia è riferita all'intero portafoglio.`,
      });
    }
  }

  // Volatility vs horizon
  if (m.volatility === undefined) {
    out.push({ id: 'volatility', status: 'info', text: `Volatilità annua: ${NA}.` });
  } else {
    const band = horizonBand(profile.horizonYears);
    out.push({
      id: 'volatility',
      status: 'info',
      text: `Volatilità annua ${pct(m.volatility)}; orizzonte indicato ${it(profile.horizonYears)} ${profile.horizonYears === 1 ? 'anno' : 'anni'} (orizzonte ${band}: ${BAND_RANGE[band]}).`,
    });
  }

  // Rolling-window returns over the user's horizon
  if (m.monthly && m.monthly.length > 1) {
    const avail = spanYears(m.monthly);
    const availTxt = avail.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const h = profile.horizonYears;
    const range = rollingReturnRange(m.monthly, h);
    if (!range) {
      out.push({
        id: 'rolling',
        status: 'info',
        text: `Orizzonte indicato ${it(h)} ${h === 1 ? 'anno' : 'anni'}; storico disponibile ${availTxt} anni: rendimenti su finestre mobili pari all'orizzonte non calcolabili.`,
      });
    } else {
      out.push({
        id: 'rolling',
        status: 'info',
        text: `Considerando ogni periodo di ${it(h)} ${h === 1 ? 'anno' : 'anni'} nello storico (finestre mobili di ${it(h)} ${h === 1 ? 'anno' : 'anni'}: ${it(range.count, 0)} osservazioni mensili su ${availTxt} anni), il rendimento annuo è andato da ${pct(range.worst, 1)} a ${pct(range.best, 1)}.`,
      });
    }
  }

  // Currency
  if (!m.currency) {
    out.push({ id: 'currency', status: 'info', text: `Valuta di quotazione: ${NA}.` });
  } else if (m.currency.toUpperCase() === 'EUR') {
    out.push({
      id: 'currency',
      status: 'info',
      text: 'Lo strumento è quotato in EUR: nessuna esposizione al cambio sulla quotazione. Le attività sottostanti possono essere denominate in altre valute.',
    });
  } else {
    out.push({
      id: 'currency',
      status: 'info',
      text: `Lo strumento è quotato in ${m.currency}: esposizione al cambio EUR/${m.currency}. Anche uno strumento quotato in EUR può detenere attività in altre valute.`,
    });
  }

  return out;
}
