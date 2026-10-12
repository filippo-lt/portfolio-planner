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
