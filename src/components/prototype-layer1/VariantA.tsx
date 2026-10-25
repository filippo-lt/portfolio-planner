// PROTOTYPE (throwaway): layer-1 variants for wayfinder ticket "What does layer 1 look like?"
'use client';

import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Disclosure } from '../ui';
import { chartTicks } from '@/lib/chartTicks';
import { fmtDate, fmtEur, fmtMonthYear, fmtNum } from '@/lib/format';
import { DataTile, HeadlineSentence, Layer2List, NotIncluded, PeriodNote, dataPoints, type VariantProps } from './shared';

/** A "Frase prima": sentence first, then a two-line chart with the gap shaded as cost. */
export function VariantA(props: VariantProps) {
  const { calc } = props;
  const rows = useMemo(
    () => (calc.ok ? calc.points.map((p) => ({ date: p.date, net: p.net, gross: p.gross, band: [p.net, p.gross] as [number, number] })) : []),
    [calc],
  );
  const ticks = useMemo(() => chartTicks(rows.map((r) => r.date)), [rows]);

  return (
    <Card className="rise">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Quanto ti è costato davvero</p>
      <HeadlineSentence {...props} className="mt-2 text-2xl sm:text-3xl" />
      <NotIncluded calc={calc} className="mt-3" />

      {calc.ok && (
        <>
          <div className="mt-5">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden="true">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-[var(--chart-a)]" /> quello che hai avuto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed border-[var(--muted)]" /> senza costi
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-3 rounded-sm bg-[var(--chart-b)] opacity-40" /> costi
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--error)]" /> tasse alla vendita
              </span>
            </div>
            <div
              role="img"
              aria-label={`Grafico su ${calc.windowLabel}. Partendo da ${fmtEur(calc.amount)}: senza costi ${fmtEur(calc.points.at(-1)?.gross)}, quello che hai avuto ${fmtEur(calc.finalNet)}, dopo le tasse ${fmtEur(calc.finalNet - calc.tax)}.`}
              className="-mx-1 mt-2 h-60 sm:h-72"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    ticks={ticks.ticks}
                    tickFormatter={(d: string) => (ticks.unit === 'year' ? d.slice(0, 4) : fmtMonthYear(d))}
                    interval={0}
                    stroke="var(--muted)"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    stroke="var(--muted)"
                    fontSize={12}
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
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
                          <p>Senza costi: {fmtEur(row.gross)}</p>
                          <p>Quello che hai avuto: {fmtEur(row.net)}</p>
                          <p className="text-muted">Costi correnti fin qui: {fmtEur(row.gross - row.net)}</p>
                        </div>
                      );
                    }}
                  />
                  <Area dataKey="band" stroke="none" fill="var(--chart-b)" fillOpacity={0.3} isAnimationActive={false} activeDot={false} />
                  <Line type="monotone" dataKey="gross" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="net" stroke="var(--chart-a)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
                  {/* Tax: a single step down at the sale date */}
                  <ReferenceLine
                    segment={[
                      { x: calc.endDate, y: calc.finalNet },
                      { x: calc.endDate, y: calc.finalNet - calc.tax },
                    ]}
                    stroke="var(--error)"
                    strokeWidth={3}
                  />
                  <ReferenceDot
                    x={calc.endDate}
                    y={calc.finalNet - calc.tax}
                    r={5}
                    fill="var(--error)"
                    stroke="var(--surface)"
                    label={{ value: `Tasse ${fmtEur(calc.tax)}`, position: 'left', fill: 'var(--error)', fontSize: 12 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-muted">
              Valore di {fmtEur(calc.amount)} investiti il {fmtDate(calc.startDate)}. L&apos;area colorata sono i costi correnti accumulati.
            </p>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
            {(['ret', 'dd', 'ter'] as const).map((k) => (
              <DataTile key={k} {...dataPoints(calc)[k]} />
            ))}
          </dl>
          <div className="mt-3">
            <PeriodNote c={calc} />
          </div>
        </>
      )}

      <Disclosure
        id="proto-l2"
        variant="sub"
        title="Vedi il dettaglio dei costi"
        preview={calc.ok ? `Costi ${fmtEur(calc.costs)} · tasse ${fmtEur(calc.tax)}` : undefined}
        className="mt-4"
      >
        <Layer2List calc={calc} />
      </Disclosure>
    </Card>
  );
}
