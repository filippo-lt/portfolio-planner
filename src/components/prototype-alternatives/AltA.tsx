// PROTOTYPE (throwaway): alternatives comparison for wayfinder ticket "How are a Product and its Alternatives compared, including Cost and Tax?"
'use client';

import { Card } from '../ui';
import { fmtEur, fmtPct } from '@/lib/format';
import { NA } from '@/lib/profileFit';
import type { AltModel } from './altData';
import { RULE_LINE } from './altData';
import { Legend, MultiLine, RuleLine } from './MultiLine';
import { statusNote } from './AltStatus';

const th = 'px-3 py-2 text-right text-xs font-medium text-muted';
function Cell({ v }: { v: string }) {
  const na = !/\d/.test(v);
  return <td className={`px-3 py-2.5 text-right tabular-nums ${na ? 'text-xs text-muted' : ''}`}>{v}</td>;
}

/** A: always-visible section after layer 1: net-value chart, then table. */
export function AltA({ model }: { model: AltModel }) {
  const { rows } = model;
  return (
    <Card className="mt-4">
      <h2 className="text-lg font-semibold tracking-tight">Le alternative con la stessa esposizione</h2>
      <div className="mt-1">
        <RuleLine windowText={model.windowText} rule={RULE_LINE} />
      </div>
      <div className="mt-4">
        <Legend rows={rows} />
        <MultiLine rows={rows.filter((r) => r.state === 'ok' || r.isProduct)} height="h-44 sm:h-56" />
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Prodotto</th>
              <th className={th}>Ti è rimasto</th>
              <th className={th}>Costi</th>
              <th className={th}>Tasse</th>
              <th className={th}>Rendimento annuo</th>
              <th className={th}>Perdita massima</th>
              <th className={th}>Costi correnti % annui</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const note = statusNote(r);
              const ok = r.state === 'ok';
              return (
                <tr key={r.symbol} className={r.isProduct ? 'bg-accent-soft/40 font-medium' : ''}>
                  <th scope="row" className="px-3 py-2.5 text-left font-medium">
                    {r.short} {r.isProduct && <span className="text-xs font-normal text-muted">(prodotto cercato)</span>}
                    <span className="block max-w-[16rem] truncate text-xs font-normal text-muted">{r.name}</span>
                    {note && <span className="block text-xs font-normal text-muted">{note}</span>}
                    {r.notes.map((n) => (
                      <span key={n} className="block text-xs font-normal text-muted">{n}</span>
                    ))}
                  </th>
                  <Cell v={ok ? fmtEur(r.kept) : NA} />
                  <Cell v={ok ? fmtEur(r.costs) : NA} />
                  <Cell v={ok ? fmtEur(r.tax) : NA} />
                  <Cell v={ok ? fmtPct(r.annualReturn) : NA} />
                  <Cell v={ok ? fmtPct(r.maxDrawdown) : NA} />
                  <Cell v={ok ? fmtPct(r.rate, 2) : NA} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Calcolo semplificato: dati mensili, tasse al 26%, costi correnti attuali applicati a tutto il periodo.</p>
    </Card>
  );
}
