// PROTOTYPE (throwaway): layer-1 variants for wayfinder ticket "What does layer 1 look like?"
'use client';

import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { Card, cx } from '../ui';
import { fmtDate, fmtEur, fmtPct } from '@/lib/format';
import { HeadlineSentence, Layer2List, NotIncluded, PeriodNote, type VariantProps } from './shared';
import { BOLLO_RATE, TAX_RATE, type ProtoOk } from './trueCostProto';

type BarKey = 'invested' | 'growth' | 'costs' | 'tax' | 'kept';

interface Bar {
  key: BarKey;
  label: string;
  /** Signed euro value shown on the bar */
  value: number;
  sign: '' | '+' | '−';
  from: number;
  to: number;
  color: string;
}

function bars(c: ProtoOk): Bar[] {
  const growth = c.finalNet + c.running - c.amount;
  const afterGrowth = c.amount + growth;
  const afterCosts = afterGrowth - c.costs;
  const lo = (a: number, b: number) => Math.min(a, b);
  const hi = (a: number, b: number) => Math.max(a, b);
  return [
    { key: 'invested', label: 'Investito', value: c.amount, sign: '', from: 0, to: c.amount, color: 'var(--border-strong)' },
    { key: 'growth', label: 'Crescita lorda', value: Math.abs(growth), sign: growth < 0 ? '−' : '+', from: lo(c.amount, afterGrowth), to: hi(c.amount, afterGrowth), color: 'var(--chart-a)' },
    { key: 'costs', label: 'Costi', value: c.costs, sign: '−', from: lo(afterGrowth, afterCosts), to: hi(afterGrowth, afterCosts), color: 'var(--chart-b)' },
    { key: 'tax', label: 'Tasse', value: c.tax, sign: '−', from: lo(afterCosts, afterCosts - c.tax), to: hi(afterCosts, afterCosts - c.tax), color: 'var(--error)' },
    { key: 'kept', label: 'Ti è rimasto', value: c.kept, sign: '', from: 0, to: c.kept, color: 'var(--success)' },
  ];
}

function Detail({ c, k }: { c: ProtoOk; k: BarKey }) {
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
  if (k === 'costs') return <Layer2List calc={c} focus={null} />;
  const body = {
    invested: [
      ['Importo investito', fmtEur(c.amount)],
      ['Data di inizio', fmtDate(c.startDate)],
      ["Commissione d'ingresso", c.entryFee === undefined ? 'Dato non disponibile' : fmtEur(c.entryFee)],
    ],
    growth: [
      ['Valore finale (già al netto dei costi correnti)', fmtEur(c.finalNet)],
      ['Costi correnti dentro il prezzo', fmtEur(c.running)],
      ['Valore finale senza costi correnti', fmtEur(c.finalNet + c.running)],
      ['Rendimento annuo dopo i costi correnti', fmtPct(c.annualReturn)],
    ],
    tax: [
      ['Guadagno', fmtEur(c.gain)],
      ['Meno imposta di bollo pagata', fmtEur(c.bollo)],
      ['Base imponibile', fmtEur(Math.max(0, c.taxBase))],
      [`Imposta al ${fmtPct(TAX_RATE, 0)}`, fmtEur(c.tax)],
      ...(c.tax === 0 ? [['Nota', 'nessun guadagno']] : []),
    ],
    kept: [
      ['Valore finale', fmtEur(c.finalNet)],
      ['Meno bollo', fmtEur(c.bollo)],
      ['Meno commissioni', c.entryRate === undefined && c.exitRate === undefined ? 'Dato non disponibile' : fmtEur(c.fees)],
      ['Meno tasse', fmtEur(c.tax)],
      ['Ti è rimasto', fmtEur(c.kept)],
    ],
  }[k];
  return <dl className="divide-y divide-line rounded-xl border border-line bg-surface px-3 text-sm">{body.map(([l, v]) => <div key={l}>{row(l, v)}</div>)}</dl>;
}

/** C "Scontrino": sparkline + horizontal waterfall, receipt-style rows. */
export function VariantC(props: VariantProps) {
  const { calc } = props;
  const [open, setOpen] = useState<BarKey | null>(null);

  if (!calc.ok) {
    return (
      <Card className="rise">
        <HeadlineSentence {...props} />
        <NotIncluded calc={calc} className="mt-3" />
      </Card>
    );
  }
  const list = bars(calc);
  const scale = Math.max(...list.map((b) => b.to), 1);
  const receipt: [string, string][] = [
    ['Rendimento annuo', fmtPct(calc.annualReturn)],
    ['Perdita massima nel periodo', fmtPct(calc.maxDrawdown)],
    ['Costi correnti', `${fmtPct(calc.rate, 2)} l'anno`],
    ['Costi pagati', fmtEur(calc.costs)],
    ['Tasse (a parte)', fmtEur(calc.tax)],
    ['Ti è rimasto', fmtEur(calc.kept)],
  ];

  return (
    <Card className="rise">
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Quanto ti è costato davvero</p>
        <p className="text-xs text-muted">su {calc.windowLabel}</p>
      </div>
      <div role="img" aria-label={`Andamento del prodotto su ${calc.windowLabel}, da ${fmtEur(calc.amount)} a ${fmtEur(calc.finalNet)}.`} className="mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={calc.points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Line type="monotone" dataKey="net" stroke="var(--chart-a)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>{fmtDate(calc.startDate)}</span>
        <span>{fmtDate(calc.endDate)}</span>
      </div>

      <HeadlineSentence {...props} className="mt-4 text-xl sm:text-2xl" />
      <NotIncluded calc={calc} className="mt-3" />

      <ul className="mt-4 space-y-1.5" aria-label="Dal capitale investito a quello che ti è rimasto">
        {list.map((b) => {
          const isOpen = open === b.key;
          const left = (b.from / scale) * 100;
          const width = Math.max(((b.to - b.from) / scale) * 100, 0.8);
          return (
            <li key={b.key}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : b.key)}
                className={cx('pressable block w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface-2', isOpen && 'bg-surface-2')}
              >
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {b.sign === '−' && b.key !== 'growth' ? '− ' : ''}
                    {b.label}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {b.key === 'growth' || b.key === 'costs' || b.key === 'tax' ? b.sign : ''}
                    {fmtEur(b.value)}
                  </span>
                </span>
                <span className="relative mt-1 block h-4 rounded bg-surface-2" aria-hidden="true">
                  <span className="absolute inset-y-0 rounded" style={{ left: `${left}%`, width: `${width}%`, background: b.color }} />
                </span>
                <span className="mt-0.5 block text-xs text-muted">{isOpen ? 'Nascondi dettaglio ▴' : 'Dettaglio ▾'}</span>
              </button>
              {isOpen && (
                <div className="mt-1.5 px-1 pb-2">
                  <Detail c={calc} k={b.key} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-dashed border-line-strong pt-3">
        <dl className="font-mono text-sm">
          {receipt.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 py-0.5">
              <dt className="shrink-0">{k}</dt>
              <span aria-hidden="true" className="min-w-2 flex-1 border-b border-dotted border-line-strong" />
              <dd className="shrink-0 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-2">
        <PeriodNote c={calc} />
        <p className="text-xs text-muted">Imposta di bollo inclusa nei costi: {fmtPct(BOLLO_RATE, 1)} l&apos;anno.</p>
      </div>
    </Card>
  );
}
