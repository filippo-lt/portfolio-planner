'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
    <figure className="mt-4">
      <div role="img" aria-label={label} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={downsample(data)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(0, 4)} minTickGap={40} stroke="#334155" fontSize={12} />
            <YAxis stroke="#334155" fontSize={12} width={44} domain={['auto', 'auto']} tickFormatter={(v: number) => fmtNum(v, 0)} />
            <Tooltip
              labelFormatter={(d) => fmtDate(String(d))}
              formatter={(v, n) => [fmtNum(Number(v)), n === 'a' ? nameA : nameB]}
            />
            <Legend formatter={(v) => (v === 'a' ? nameA : nameB)} />
            <Line type="monotone" dataKey="a" stroke="#1e3a8a" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="b" stroke="#64748b" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-sm text-slate-700">
        Prezzi rebasati a 100 al {fmtDate(first.date)} (prima data in comune), nelle rispettive valute di quotazione.
      </figcaption>
    </figure>
  );
}
