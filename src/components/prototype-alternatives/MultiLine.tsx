// PROTOTYPE (throwaway): alternatives comparison for wayfinder ticket "How are a Product and its Alternatives compared, including Cost and Tax?"
'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { chartTicks } from '@/lib/chartTicks';
import { fmtEur, fmtMonthYear, fmtNum } from '@/lib/format';
import type { Row } from './altData';

const COLORS = ['var(--chart-a)', 'var(--chart-b)', 'var(--muted)', 'var(--error)'];
export const colorOf = (i: number) => COLORS[i % COLORS.length];

/** Net value path of each row on one chart; the first row is emphasised. Merged by year-month. */
export function MultiLine({ rows, height = 'h-52', colors }: { rows: Row[]; height?: string; colors?: string[] }) {
  const data = useMemo(() => {
    const base = rows.find((r) => r.path.length);
    if (!base) return [];
    const maps = rows.map((r) => new Map(r.path.map((p) => [p.date.slice(0, 7), p.net])));
    return base.path.map((p) => {
      const o: Record<string, string | number | undefined> = { date: p.date };
      rows.forEach((_, i) => (o['s' + i] = maps[i].get(p.date.slice(0, 7))));
      return o;
    });
  }, [rows]);
  const ticks = useMemo(() => chartTicks(data.map((d) => d.date as string)), [data]);
  if (!data.length) return <p className="text-sm text-muted">Dato non disponibile</p>;
  const col = (i: number) => colors?.[i] ?? colorOf(i);
  const desc = rows.map((r) => `${r.short}: ${fmtEur(r.path.at(-1)?.net)}`).join('; ');
  return (
    <div role="img" aria-label={`Valore netto nel tempo. Alla fine: ${desc}`} className={`-mx-1 ${height}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          <YAxis stroke="var(--muted)" fontSize={12} width={44} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => fmtNum(v, 0)} />
          {rows.map((r, i) => (
            <Line
              key={r.symbol}
              type="monotone"
              dataKey={'s' + i}
              stroke={col(i)}
              strokeWidth={i === 0 ? 2.75 : 1.5}
              strokeDasharray={i === 0 ? undefined : i === 2 ? '5 4' : i === 3 ? '2 3' : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ rows, colors }: { rows: Row[]; colors?: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden="true">
      {rows.map((r, i) => (
        <span key={r.symbol} className="flex items-center gap-1.5">
          <span className="w-4 rounded" style={{ height: i === 0 ? 3 : 2, background: colors?.[i] ?? colorOf(i) }} />
          <span className={i === 0 ? 'font-semibold' : ''}>{r.short}</span>
        </span>
      ))}
    </div>
  );
}

export function RuleLine({ windowText, rule }: { windowText: string; rule: string }) {
  return (
    <div className="text-sm text-muted">
      <p>{windowText}</p>
      <p>{rule}</p>
    </div>
  );
}
