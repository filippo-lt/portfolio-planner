'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RebasedPoint } from '@/lib/metrics';
import { fmtDate, fmtNum } from '@/lib/format';

function downsample(data: RebasedPoint[], max = 400): RebasedPoint[] {
  if (data.length <= max) return data;
  const step = Math.ceil(data.length / max);
  const out = data.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== data[data.length - 1]) out.push(data[data.length - 1]);
  return out;
}

export function PriceChart({ data, nameA, nameB }: { data: RebasedPoint[]; nameA: string; nameB: string }) {
  const first = data[0];
  const last = data[data.length - 1];
  const label = `Grafico a linee, base 100 al ${fmtDate(first.date)}. Al ${fmtDate(last.date)}: ${nameA} ${fmtNum(last.a)}, ${nameB} ${fmtNum(last.b)}.`;
  return (
    <figure className="card mt-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2" aria-hidden="true">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-a)]" />
            <span className="font-medium">{nameA}</span>
            <span className="tabular-nums text-muted">{fmtNum(last.a, 0)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-[var(--chart-b)]" />
            <span className="font-medium">{nameB}</span>
            <span className="tabular-nums text-muted">{fmtNum(last.b, 0)}</span>
          </span>
        </div>
      </div>
      <div role="img" aria-label={label} className="-mx-1 mt-3 h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={downsample(data)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(0, 4)}
              minTickGap={32}
              stroke="var(--muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              stroke="var(--muted)"
              fontSize={12}
              width={36}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => fmtNum(v, 0)}
            />
            <Tooltip
              labelFormatter={(d) => fmtDate(String(d))}
              formatter={(v, n) => [fmtNum(Number(v)), n === 'a' ? nameA : nameB]}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text)',
                fontSize: 13,
              }}
              cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
            />
            <Line type="monotone" dataKey="a" stroke="var(--chart-a)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="b" stroke="var(--chart-b)" strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        Valore di 100 investiti il {fmtDate(first.date)} (prima data in comune), nelle rispettive valute di quotazione.
      </figcaption>
    </figure>
  );
}
