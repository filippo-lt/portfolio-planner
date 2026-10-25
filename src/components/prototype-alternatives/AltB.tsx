// PROTOTYPE (throwaway): alternatives comparison for wayfinder ticket "How are a Product and its Alternatives compared, including Cost and Tax?"
'use client';

import { fmtEur } from '@/lib/format';
import { NA } from '@/lib/profileFit';
import type { AltModel, Row } from './altData';
import { RULE_LINE, deltaPhrase } from './altData';
import { Legend, MultiLine, RuleLine } from './MultiLine';
import { statusNote } from './AltStatus';

function sentence(p: Row, a: Row): string {
  const note = statusNote(a);
  if (note) return `${a.short}: ${note.toLowerCase()}.`;
  if (p.state !== 'ok') return `Confronto con ${a.short}: dato del prodotto non disponibile.`;
  const c = deltaPhrase('costi', a.costs, p.costs, fmtEur);
  const t = deltaPhrase('tasse', a.tax, p.tax, fmtEur);
  let k: string;
  if (a.kept === undefined || p.kept === undefined) k = 'ti sarebbe rimasto: dato non disponibile';
  else {
    const d = a.kept - p.kept;
    k = Math.abs(d) < 0.5 ? 'ti sarebbe rimasto lo stesso importo' : `ti sarebbe rimasto ${fmtEur(Math.abs(d))} in ${d > 0 ? 'più' : 'meno'}`;
  }
  return `Con ${a.short} avresti pagato ${c} e ${t}; ${k}.`;
}

function Cmp({ label, p, a }: { label: string; p: string; a: string }) {
  const cell = (v: string) => <td className={`px-3 py-1.5 text-right tabular-nums ${/\d/.test(v) ? '' : 'text-xs text-muted'}`}>{v}</td>;
  return (
    <tr>
      <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted">{label}</th>
      {cell(p)}
      {cell(a)}
    </tr>
  );
}

/** B: pairwise cards, rendered inside layer 2 after the cost line items. */
export function AltB({ model }: { model: AltModel }) {
  const [p, ...alts] = model.rows;
  if (!model.hasAlts) return null;
  const f = (r: Row, v?: number) => (r.state === 'ok' ? fmtEur(v) : NA);
  return (
    <div className="mt-5">
      <h3 className="font-semibold">Le alternative con la stessa esposizione</h3>
      <div className="mt-1">
        <RuleLine windowText={model.windowText} rule={RULE_LINE} />
      </div>
      <div className="mt-3 space-y-3">
        {alts.map((a) => {
          const pair = [p, a];
          const ok = a.state === 'ok' && p.state === 'ok';
          return (
            <div key={a.symbol} className="rounded-xl border border-line bg-surface p-3">
              <p className="font-medium leading-snug">{sentence(p, a)}</p>
              <p className="text-xs text-muted">{a.name}</p>
              {ok && (
                <>
                  <div className="mt-2">
                    <Legend rows={pair} />
                    <MultiLine rows={pair} height="h-32" />
                  </div>
                  <table className="mt-1 w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs text-muted">
                        <th className="px-3 py-1 text-left font-medium"><span className="sr-only">Voce</span></th>
                        <th className="px-3 py-1 text-right font-medium">{p.short}</th>
                        <th className="px-3 py-1 text-right font-medium">{a.short}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      <Cmp label="Costi" p={f(p, p.costs)} a={f(a, a.costs)} />
                      <Cmp label="Tasse" p={f(p, p.tax)} a={f(a, a.tax)} />
                      <Cmp label="Ti è rimasto" p={f(p, p.kept)} a={f(a, a.kept)} />
                    </tbody>
                  </table>
                  {[...p.notes, ...a.notes].map((n) => (
                    <p key={n} className="mt-1 text-xs text-muted">{n}</p>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
