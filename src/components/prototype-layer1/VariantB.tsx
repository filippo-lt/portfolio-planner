// PROTOTYPE (throwaway): layer-1 variants for wayfinder ticket "What does layer 1 look like?"
'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, cx } from '../ui';
import { chartTicks } from '@/lib/chartTicks';
import { fmtDate, fmtEur, fmtMonthYear, fmtNum } from '@/lib/format';
import { DataTile, HeadlineSentence, Layer2List, NotIncluded, PeriodNote, dataPoints, type FocusKey, type VariantProps } from './shared';

const COLORS = { running: 'var(--chart-b)', bollo: 'var(--accent-2)', fees: 'var(--bar-2)', tax: 'var(--error)' } as const;

/** B "Banda costi cumulata": chart-first, net line above, stacked cumulative euros paid below. */
export function VariantB(props: VariantProps) {
  const { calc } = props;
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<FocusKey | null>(null);
  const rows = useMemo(() => (calc.ok ? calc.points : []), [calc]);
  const ticks = useMemo(() => chartTicks(rows.map((r) => r.date)), [rows]);

  const pick = (k: FocusKey) => {
    setFocus(k);
    setOpen(true);
  };
  const xAxis = (hide: boolean) => (
    <XAxis
      dataKey="date"
      ticks={ticks.ticks}
      tickFormatter={(d: string) => (ticks.unit === 'year' ? d.slice(0, 4) : fmtMonthYear(d))}
      interval={0}
      stroke="var(--muted)"
      tickLine={false}
      axisLine={false}
      fontSize={12}
      hide={hide}
    />
  );
  const margin = { top: 8, right: 12, bottom: 0, left: 0 };

  return (
    <Card className="rise">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Quanto ti è costato davvero</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="pressable shrink-0 rounded-full border border-line-strong px-3 py-1 text-xs font-semibold hover:bg-surface-2"
        >
          Livello 2 {open ? '▴' : '▾'}
        </button>
      </div>
      <HeadlineSentence {...props} className="mt-2 text-base sm:text-lg" />

      {calc.ok && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
          <div>
            <p className="text-xs text-muted">Valore (quello che hai avuto)</p>
            <div role="img" aria-label={`Valore di ${fmtEur(calc.amount)} su ${calc.windowLabel}: da ${fmtEur(calc.amount)} a ${fmtEur(calc.finalNet)}.`} className="-mx-1 h-40 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} syncId="proto-b" margin={margin}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  {xAxis(true)}
                  <YAxis stroke="var(--muted)" fontSize={12} width={48} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => fmtNum(v, 0)} />
                  <Tooltip
                    cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
                    content={(t) => {
                      const row = t.payload?.[0]?.payload as (typeof rows)[number] | undefined;
                      if (!t.active || !row) return null;
                      return (
                        <div className="rounded-xl border border-line bg-surface p-2.5 text-[13px] shadow-sm">
                          <p className="font-medium">{fmtDate(row.date)}</p>
                          <p>Valore: {fmtEur(row.net)}</p>
                          <p className="text-muted">Pagato fin qui: {fmtEur(row.running + row.bollo + row.fees)}</p>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="net" stroke="var(--chart-a)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-1 text-xs text-muted">Euro pagati, cumulati (tocca una banda per il dettaglio)</p>
            <div
              role="img"
              aria-label={`Euro pagati nel tempo: costi correnti ${fmtEur(calc.running)}, bollo ${fmtEur(calc.bollo)}${calc.fees > 0 ? `, commissioni ${fmtEur(calc.fees)}` : ''}; tasse alla vendita ${fmtEur(calc.tax)}.`}
              className="-mx-1 h-48 sm:h-56"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} syncId="proto-b" margin={{ ...margin, top: 28 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  {xAxis(false)}
                  <YAxis
                    stroke="var(--muted)"
                    fontSize={12}
                    width={48}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, Math.max(1, calc.costs + calc.tax)]}
                    tickFormatter={(v: number) => fmtNum(v, 0)}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
                    content={(t) => {
                      const row = t.payload?.[0]?.payload as (typeof rows)[number] | undefined;
                      if (!t.active || !row) return null;
                      return (
                        <div className="rounded-xl border border-line bg-surface p-2.5 text-[13px] shadow-sm">
                          <p className="font-medium">{fmtDate(row.date)}</p>
                          <p>Costi correnti: {fmtEur(row.running)}</p>
                          <p>Bollo: {fmtEur(row.bollo)}</p>
                          {calc.fees > 0 && <p>Commissioni: {fmtEur(row.fees)}</p>}
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" stackId="p" dataKey="running" stroke={COLORS.running} fill={COLORS.running} fillOpacity={0.55} isAnimationActive={false} className="cursor-pointer" onClick={() => pick('running')} />
                  <Area type="monotone" stackId="p" dataKey="bollo" stroke={COLORS.bollo} fill={COLORS.bollo} fillOpacity={0.55} isAnimationActive={false} className="cursor-pointer" onClick={() => pick('bollo')} />
                  {calc.fees > 0 && (
                    <Area type="monotone" stackId="p" dataKey="fees" stroke={COLORS.fees} fill={COLORS.fees} fillOpacity={0.55} isAnimationActive={false} className="cursor-pointer" onClick={() => pick('fees')} />
                  )}
                  {/* Tax: a separate block at the sale date, stacked on top of what was paid */}
                  <ReferenceArea
                    x1={rows[Math.max(0, rows.length - 1 - Math.max(1, Math.round(rows.length * 0.03)))].date}
                    x2={calc.endDate}
                    y1={calc.costs}
                    y2={calc.costs + calc.tax}
                    fill={COLORS.tax}
                    fillOpacity={0.7}
                    stroke={COLORS.tax}
                    className="cursor-pointer"
                    onClick={() => pick('tax')}
                  />
                  <ReferenceDot
                    x={calc.endDate}
                    y={calc.costs + calc.tax}
                    r={0}
                    label={{ value: `Costi ${fmtEur(calc.costs)} · Tasse ${fmtEur(calc.tax)}`, position: 'top', fill: 'var(--text)', fontSize: 13, fontWeight: 600, offset: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Voci di costo">
              {(
                [
                  ['running', 'Costi correnti', fmtEur(calc.running)],
                  ['bollo', 'Bollo', fmtEur(calc.bollo)],
                  ...(calc.fees > 0 ? [['fees', 'Commissioni', fmtEur(calc.fees)]] : []),
                  ['tax', 'Tasse', fmtEur(calc.tax)],
                ] as [FocusKey & keyof typeof COLORS, string, string][]
              ).map(([k, label, val]) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => pick(k)}
                    aria-pressed={focus === k}
                    className={cx('pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm', focus === k ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2')}
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] }} />
                    {label} <span className="tabular-nums text-muted">{val}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <dl className="grid grid-cols-2 content-start gap-2 lg:grid-cols-1">
            {(['kept', 'ret', 'dd', 'ter'] as const).map((k) => (
              <DataTile key={k} {...dataPoints(calc)[k]} />
            ))}
          </dl>
        </div>
      )}

      <NotIncluded calc={calc} className="mt-3" />
      {calc.ok && (
        <div className="mt-1">
          <PeriodNote c={calc} />
        </div>
      )}

      {open && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Livello 2: voci di costo</h3>
          <Layer2List calc={calc} focus={focus} />
        </div>
      )}
    </Card>
  );
}
