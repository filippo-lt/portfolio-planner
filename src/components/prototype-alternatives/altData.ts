// PROTOTYPE (throwaway): alternatives comparison for wayfinder ticket "How are a Product and its Alternatives compared, including Cost and Tax?"
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Report } from '@/lib/report';
import { computeTrueCost, type ProtoCalc, type ProtoOk } from '../prototype-layer1/trueCostProto';

/** Hard-coded Product -> Alternatives (the real matching rule is not built yet). */
export const ALTERNATIVES: Record<string, string[]> = {
  'SWDA.MI': ['XDWD.MI', 'IWRD.MI', 'SWRD.MI'],
  'CSSPX.MI': ['SXR8.DE', 'SPXS.MI', 'VUSA.MI'],
};

export const RULE_LINE = 'Stessa esposizione (classe, area, stile); a parità, volatilità più vicina.';

export type RowState = 'ok' | 'loading' | 'error' | 'history' | 'ter';

export interface Row {
  symbol: string;
  short: string;
  name: string;
  isProduct: boolean;
  state: RowState;
  calc?: ProtoOk;
  costs?: number;
  tax?: number;
  kept?: number;
  annualReturn?: number;
  maxDrawdown?: number;
  rate?: number;
  /** Total before costs and tax: kept + costs + tax = value without running costs */
  total?: number;
  path: { date: string; net: number }[];
  notes: string[];
}

type Fetched = Record<string, { status: 'loading' | 'ok' | 'error'; report?: Report }>;

const ym = (d: string) => d.slice(0, 7);
export const shortSym = (s: string) => s.split('.')[0];

function altCalc(rep: Report, p: ProtoOk, amount: number): ProtoCalc | 'history' {
  const all = [...rep.monthly].sort((a, b) => a.date.localeCompare(b.date));
  if (!all.length || ym(all[0].date) > ym(p.startDate)) return 'history';
  const upto = all.filter((x) => ym(x.date) <= ym(p.endDate));
  if (!upto.length || ym(upto[upto.length - 1].date) < ym(p.endDate)) return 'history';
  let si = 0;
  upto.forEach((x, i) => {
    if (ym(x.date) <= ym(p.startDate)) si = i;
  });
  return computeTrueCost({ ...rep, monthly: upto.slice(si) }, amount);
}

function rowFrom(symbol: string, name: string, isProduct: boolean, state: RowState, calc?: ProtoOk): Row {
  const base: Row = { symbol, short: shortSym(symbol), name, isProduct, state, path: [], notes: [] };
  if (!calc) return base;
  return {
    ...base,
    calc,
    costs: calc.costs,
    tax: calc.tax,
    kept: calc.kept,
    annualReturn: calc.annualReturn,
    maxDrawdown: calc.maxDrawdown,
    rate: calc.rate,
    total: calc.kept + calc.costs + calc.tax,
    path: calc.points.map((p) => ({ date: p.date, net: p.net })),
  };
}

export interface AltModel {
  rows: Row[];
  windowText: string;
  loadingAny: boolean;
  hasAlts: boolean;
}

export function useAlternatives(report: Report, calc: ProtoCalc, amount: number, gap: boolean): AltModel {
  const symbol = report.instrument.symbol;
  const alts = useMemo(() => ALTERNATIVES[symbol.toUpperCase()] ?? [], [symbol]);
  const [fetched, setFetched] = useState<Fetched>({});

  useEffect(() => {
    let dead = false;
    for (const s of alts) {
      fetch(`/api/report?symbol=${encodeURIComponent(s)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((rep: Report) => !dead && setFetched((f) => ({ ...f, [s]: { status: 'ok', report: rep } })))
        .catch(() => !dead && setFetched((f) => ({ ...f, [s]: { status: 'error' } })));
    }
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return useMemo(() => {
    const pRow = calc.ok
      ? rowFrom(symbol, report.instrument.name, true, 'ok', calc)
      : rowFrom(symbol, report.instrument.name, true, calc.reason === 'ter' ? 'ter' : 'history');
    if (gap) pRow.notes.push('Commissione di uscita: non inclusa');
    const pVol = report.metrics.volatility;

    const altRows = alts.map((s) => {
      const f = fetched[s];
      const vol = f?.report?.metrics.volatility;
      let row: Row;
      if (!f || f.status === 'loading') row = rowFrom(s, s, false, 'loading');
      else if (f.status === 'error' || !f.report) row = rowFrom(s, s, false, 'error');
      else {
        const name = f.report.instrument.name;
        if (!calc.ok) row = rowFrom(s, name, false, 'history');
        else {
          const c = altCalc(f.report, calc, amount);
          if (c === 'history' || (!c.ok && c.reason === 'history')) row = rowFrom(s, name, false, 'history');
          else if (!c.ok) row = rowFrom(s, name, false, 'ter');
          else row = rowFrom(s, name, false, 'ok', c);
        }
      }
      return { row, dist: vol !== undefined && pVol !== undefined ? Math.abs(vol - pVol) : Infinity };
    });
    altRows.sort((a, b) => a.dist - b.dist || a.row.symbol.localeCompare(b.row.symbol));
    const rows = [pRow, ...altRows.map((a) => a.row)];
    if (gap && rows[2]) {
      rows[2] = { ...rows[2], tax: undefined, kept: undefined };
      rows[2].notes.push('Tasse: dato non disponibile (forzato con ?gap=1)');
    }
    return {
      rows,
      windowText: calc.ok ? `Stessi ${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' }).format(calc.amount)} €, stesso periodo: ${calc.windowLabel}` : 'Periodo non calcolabile per il prodotto',
      loadingAny: alts.some((s) => !fetched[s] || fetched[s].status === 'loading'),
      hasAlts: alts.length > 0,
    };
  }, [alts, fetched, calc, amount, gap, report, symbol]);
}

/** Euro delta phrase: "340 € di costi in meno". Undefined values read "costi: dato non disponibile". */
export function deltaPhrase(label: string, alt: number | undefined, prod: number | undefined, fmt: (n: number) => string): string {
  if (alt === undefined || prod === undefined) return `${label}: dato non disponibile`;
  const d = alt - prod;
  if (Math.abs(d) < 0.5) return `gli stessi ${label}`;
  return `${fmt(Math.abs(d))} di ${label} in ${d < 0 ? 'meno' : 'più'}`;
}
