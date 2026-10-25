// PROTOTYPE (throwaway): alternatives comparison for wayfinder ticket "How are a Product and its Alternatives compared, including Cost and Tax?"
'use client';

import { useState } from 'react';
import { Disclosure } from '../ui';
import { fmtEur } from '@/lib/format';
import { NA } from '@/lib/profileFit';
import type { AltModel, Row } from './altData';
import { RULE_LINE } from './altData';
import { Legend, MultiLine, RuleLine } from './MultiLine';
import { statusNote } from './AltStatus';

const HATCH = 'repeating-linear-gradient(45deg, var(--border-strong) 0 4px, transparent 4px 8px)';

function Seg({ pct, color, hatch, label }: { pct: number; color?: string; hatch?: boolean; label: string }) {
  if (pct <= 0) return null;
  return (
    <div
      title={label}
      style={{ width: `${pct}%`, background: hatch ? HATCH : color }}
      className={hatch ? 'border border-dashed border-[var(--muted)]' : ''}
    />
  );
}

function Bar({ r, max }: { r: Row; max: number }) {
  const note = statusNote(r);
  const ok = r.state === 'ok' && r.total !== undefined && r.costs !== undefined;
  const taxKnown = r.tax !== undefined && r.kept !== undefined;
  const pct = (v: number) => (v / max) * 100;
  return (
    <li className="py-2.5">
      <p className="text-sm">
        <span className="font-semibold">{r.short}</span> {r.isProduct && <span className="text-xs text-muted">(prodotto cercato)</span>}
      </p>
      {ok ? (
        <>
          <div
            className="mt-1 flex h-6 overflow-hidden rounded bg-[var(--grid)]"
            role="img"
            aria-label={`${r.short}: ti è rimasto ${fmtEur(r.kept)}, costi ${fmtEur(r.costs)}, tasse ${fmtEur(r.tax)}`}
          >
            {taxKnown ? (
              <>
                <Seg pct={pct(r.kept!)} color="var(--chart-a)" label="Ti è rimasto" />
                <Seg pct={pct(r.costs!)} color="var(--chart-b)" label="Costi" />
                <Seg pct={pct(r.tax!)} color="var(--error)" label="Tasse" />
              </>
            ) : (
              <>
                <Seg pct={pct(r.total! - r.costs!)} hatch label="Ti è rimasto e tasse: dato non disponibile" />
                <Seg pct={pct(r.costs!)} color="var(--chart-b)" label="Costi" />
              </>
            )}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 text-xs tabular-nums">
            {taxKnown ? (
              <>
                <span>Ti è rimasto {fmtEur(r.kept)}</span>
                <span>Costi {fmtEur(r.costs)}</span>
                <span>Tasse {fmtEur(r.tax)}</span>
              </>
            ) : (
              <>
                <span className="text-muted">Ti è rimasto e tasse: dato non disponibile</span>
                <span>Costi {fmtEur(r.costs)}</span>
              </>
            )}
          </p>
          {r.notes.map((n) => (
            <p key={n} className="text-xs text-muted">{n}</p>
          ))}
        </>
      ) : (
        <div className="mt-1 flex h-6 items-center rounded border border-dashed border-[var(--muted)] px-2 text-xs text-muted" style={{ background: HATCH }}>
          <span className="rounded bg-surface px-1">{r.state === 'ter' ? NA : note ?? NA}</span>
        </div>
      )}
    </li>
  );
}

/** C: its own disclosure below layer 1; stacked bars at one euro scale, line chart on demand. */
export function AltC({ model }: { model: AltModel }) {
  const [showLines, setShowLines] = useState(false);
  const max = Math.max(1, ...model.rows.map((r) => (r.state === 'ok' ? r.total ?? 0 : 0)));
  const okRows = model.rows.filter((r) => r.state === 'ok');
  return (
    <Disclosure id="proto-alt-c" variant="sub" title="Confronta con le alternative" className="mt-4">
      <RuleLine windowText={model.windowText} rule={RULE_LINE} />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-[var(--chart-a)]" /> Ti è rimasto</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-[var(--chart-b)]" /> Costi</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-[var(--error)]" /> Tasse</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm border border-dashed border-[var(--muted)]" style={{ background: HATCH }} /> dato non disponibile</span>
      </div>
      <ul className="mt-1 divide-y divide-line">
        {model.rows.map((r) => (
          <Bar key={r.symbol} r={r} max={max} />
        ))}
      </ul>
      <p className="text-xs text-muted">Stessa scala in euro per tutte le barre: la lunghezza è il valore senza costi correnti.</p>
      <button
        type="button"
        aria-expanded={showLines}
        onClick={() => setShowLines((v) => !v)}
        className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-accent-soft"
      >
        {showLines ? 'nascondi andamento' : 'mostra andamento'}
      </button>
      {showLines && (
        <div className="mt-2">
          <Legend rows={okRows} />
          <MultiLine rows={okRows} height="h-40" />
        </div>
      )}
    </Disclosure>
  );
}
