// PROTOTYPE (throwaway): layer-1 variants for wayfinder ticket "What does layer 1 look like?"
/** Rough "true cost" calc for the layer-1 prototype. Prototype quality: monthly data, flat 26% tax, no bond 12.5%. */
import type { Report } from '@/lib/report';
import { effectiveFees } from '@/lib/fees';

export const DEFAULT_AMOUNT = 10000;
export const BOLLO_RATE = 0.002;
export const TAX_RATE = 0.26;

export interface ProtoPoint {
  date: string;
  /** Value of the amount after running costs (what you had) */
  net: number;
  /** Value without running costs: net plus cumulative running cost */
  gross: number;
  /** Cumulative euros paid */
  running: number;
  bollo: number;
  fees: number;
}

export interface ProtoOk {
  ok: true;
  amount: number;
  windowKey: '10y' | '5y' | 'all';
  /** "10 anni", "5 anni", "3 anni e 8 mesi" */
  windowLabel: string;
  startDate: string;
  endDate: string;
  years: number;
  rate: number;
  points: ProtoPoint[];
  running: number;
  bollo: number;
  bolloByYear: { year: number; amount: number }[];
  entryFee?: number;
  exitFee?: number;
  entryRate?: number;
  exitRate?: number;
  fees: number;
  /** running + bollo + fees. Never includes tax. */
  costs: number;
  finalNet: number;
  gain: number;
  taxBase: number;
  tax: number;
  kept: number;
  annualReturn: number;
  maxDrawdown: number;
  /** Items that could not be computed, for the "Non inclusi" line */
  notIncluded: string[];
}

export interface ProtoNo {
  ok: false;
  reason: 'ter' | 'history';
  message: string;
  notIncluded: string[];
}

export type ProtoCalc = ProtoOk | ProtoNo;

export const BANK_ITEM = 'Costi della banca (scegli la tua banca)';

const ms = (d: string) => Date.parse(d + 'T00:00:00Z');
const DAY = 86_400_000;

function monthDiff(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
}

export function lengthLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y === 1 ? '1 anno' : `${y} anni`;
  if (y === 0) return m === 1 ? '1 mese' : `${m} mesi`;
  if (m === 0) return ys;
  return `${ys} e ${m === 1 ? '1 mese' : `${m} mesi`}`;
}

/** Parses "10.000", "10000", "10.000,50" typed in Italian. Undefined when not a positive number. */
export function parseAmount(raw: string): number | undefined {
  const s = raw.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const v = Number(s);
  return v > 0 && v <= 1e9 ? v : undefined;
}

export function computeTrueCost(report: Report, amount: number): ProtoCalc {
  const ins = report.instrument;
  const fees = effectiveFees(ins);
  const notIncluded: string[] = [];
  if (!fees.entry) notIncluded.push("Commissioni d'ingresso");
  if (!fees.exit) notIncluded.push("Commissioni d'uscita");
  if (fees.performance) notIncluded.push('Commissione di performance');
  notIncluded.push(BANK_ITEM);

  const all = [...report.monthly].sort((a, b) => a.date.localeCompare(b.date));
  if (ins.ter === undefined || !Number.isFinite(ins.ter)) {
    return { ok: false, reason: 'ter', message: 'Dato non disponibile', notIncluded };
  }
  if (all.length < 2) return { ok: false, reason: 'history', message: 'Storico inferiore a un anno: costo reale non calcolabile', notIncluded };

  const rate = ins.ter;
  const end = all[all.length - 1].date;
  const totalMonths = monthDiff(all[0].date, end);
  let startIdx = 0;
  let windowKey: ProtoOk['windowKey'] = 'all';
  for (const [key, yrs] of [['10y', 10], ['5y', 5]] as const) {
    const cutoff = `${Number(end.slice(0, 4)) - yrs}${end.slice(4)}`;
    if (all[0].date <= cutoff) {
      let idx = 0;
      all.forEach((p, i) => {
        if (p.date <= cutoff) idx = i;
      });
      startIdx = idx;
      windowKey = key;
      break;
    }
  }
  const win = all.slice(startIdx);
  if (totalMonths < 12) {
    return { ok: false, reason: 'history', message: 'Storico inferiore a un anno: costo reale non calcolabile', notIncluded };
  }
  const windowLabel = windowKey === '10y' ? '10 anni' : windowKey === '5y' ? '5 anni' : lengthLabel(totalMonths);

  const p0 = win[0].close;
  const startDate = win[0].date;
  const years = (ms(end) - ms(startDate)) / (365.25 * DAY);
  const value = win.map((p) => (amount * p.close) / p0);

  // Bollo: 0,2% of the value at each 31 Dec (and at the end), pro-rated for partial first/last years.
  const bookings: { date: string; amount: number; year: number }[] = [];
  const y0 = Number(startDate.slice(0, 4));
  const y1 = Number(end.slice(0, 4));
  const valueAt = (d: string) => {
    let v = value[0];
    win.forEach((p, i) => {
      if (p.date <= d) v = value[i];
    });
    return v;
  };
  for (let y = y0; y <= y1; y++) {
    const ps = y === y0 ? startDate : `${y}-01-01`;
    const pe = y === y1 ? end : `${y}-12-31`;
    const days = (ms(pe) - ms(ps)) / DAY + 1;
    const frac = Math.min(1, days / 365);
    bookings.push({ date: pe, amount: BOLLO_RATE * valueAt(pe) * frac, year: y });
  }

  const entryFee = fees.entry ? amount * fees.entry.value : undefined;
  const exitFee = fees.exit ? value[value.length - 1] * fees.exit.value : undefined;

  const points: ProtoPoint[] = [];
  let run = 0;
  let bol = 0;
  let bi = 0;
  win.forEach((p, i) => {
    if (i > 0) run += (value[i] * rate) / 12;
    while (bi < bookings.length && bookings[bi].date <= p.date) bol += bookings[bi++].amount;
    const last = i === win.length - 1;
    points.push({
      date: p.date,
      net: value[i],
      gross: value[i] + run,
      running: run,
      bollo: bol,
      fees: (entryFee ?? 0) + (last ? (exitFee ?? 0) : 0),
    });
  });
  const lastP = points[points.length - 1];
  const finalNet = lastP.net;
  const bollo = lastP.bollo;
  const feeSum = (entryFee ?? 0) + (exitFee ?? 0);
  const costs = lastP.running + bollo + feeSum;
  const gain = finalNet - amount;
  const taxBase = gain - bollo;
  const tax = taxBase > 0 ? taxBase * TAX_RATE : 0;
  const kept = finalNet - bollo - feeSum - tax;

  let peak = win[0].close;
  let dd = 0;
  for (const p of win) {
    peak = Math.max(peak, p.close);
    dd = Math.min(dd, p.close / peak - 1);
  }

  return {
    ok: true,
    amount,
    windowKey,
    windowLabel,
    startDate,
    endDate: end,
    years,
    rate,
    points,
    running: lastP.running,
    bollo,
    bolloByYear: bookings.map((b) => ({ year: b.year, amount: b.amount })),
    entryFee,
    exitFee,
    entryRate: fees.entry?.value,
    exitRate: fees.exit?.value,
    fees: feeSum,
    costs,
    finalNet,
    gain,
    taxBase,
    tax,
    kept,
    annualReturn: Math.pow(win[win.length - 1].close / p0, 1 / years) - 1,
    maxDrawdown: dd,
    notIncluded,
  };
}
