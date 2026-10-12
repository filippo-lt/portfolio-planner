import { NA } from './profileFit';

export { NA };

const nf = (digits: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmtPct(v: number | undefined | null, digits = 1): string {
  return v === undefined || v === null || !Number.isFinite(v) ? NA : `${nf(digits).format(v * 100)}%`;
}

export function fmtNum(v: number | undefined | null, digits = 1): string {
  return v === undefined || v === null || !Number.isFinite(v) ? NA : nf(digits).format(v);
}

export function fmtBig(v: number | undefined | null, currency?: string): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return NA;
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1e12) s = `${nf(1).format(v / 1e12)} bln`;
  else if (abs >= 1e9) s = `${nf(1).format(v / 1e9)} mld`;
  else if (abs >= 1e6) s = `${nf(1).format(v / 1e6)} mln`;
  else s = nf(0).format(v);
  return currency ? `${s} ${currency}` : s;
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return NA;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtYears(y: number): string {
  return nf(1).format(y);
}

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "2023-01-15" -> "gen 23" */
export function fmtMonthYear(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTHS_IT[Number(m) - 1]} ${y.slice(2)}`;
}

/** Percentage with explicit sign: 0.123 -> "+12,3%", -0.05 -> "-5,0%". */
export function fmtPctSigned(v: number, digits = 1): string {
  const s = fmtPct(v, digits);
  return v > 0 && s !== NA ? `+${s}` : s;
}

/** Whole euros: 1000 -> "1.000 €". */
export function fmtEur(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return NA;
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' }).format(v)} €`;
}
