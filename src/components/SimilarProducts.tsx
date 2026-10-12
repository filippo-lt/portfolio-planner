'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { AssetClass, PricePoint } from '@/lib/data/types';
import { NA } from '@/lib/profileFit';
import { fmtEur, fmtPct } from '@/lib/format';
import { applyGrowth } from '@/lib/simulation';
import { SIMILAR_RULE, fundPeriods, type SimilarItem } from '@/lib/similar';

const feeText = (v: number | undefined) => (v === undefined ? 'non inclusa' : fmtPct(v, 2));

function Outcome({ label, amount, ratio, item }: { label: string; amount: number; ratio: number | undefined; item: SimilarItem }) {
  const r = ratio === undefined ? undefined : applyGrowth(amount, ratio, item.entryFee, item.exitFee);
  return (
    <p className="text-sm tabular-nums">
      <span className="text-xs text-muted">{label}: </span>
      {r ? `${fmtEur(amount)} → ${fmtEur(r.netValue)}` : NA}
    </p>
  );
}

/**
 * Curated products of the same class, ordered by closest volatility, all styled the same.
 * Loads after the report; hidden when there is nothing to show.
 */
export function SimilarProducts({
  symbol,
  assetClass,
  volatility,
  prices,
  amount,
}: {
  symbol: string;
  assetClass: AssetClass;
  volatility: number | undefined;
  /** The series the euro box simulates for the fund: the similar products use the same dates */
  prices: PricePoint[];
  amount: number;
}) {
  const id = useId();
  const eligible = assetClass !== 'unknown' && assetClass !== 'other' && volatility !== undefined;
  const periods = useMemo(() => fundPeriods(prices), [prices]);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ symbol });
    if (periods.full) {
      p.set('from', periods.full.from);
      p.set('to', periods.full.to);
    }
    if (periods.year) {
      p.set('yfrom', periods.year.from);
      p.set('yto', periods.year.to);
    }
    return p.toString();
  }, [symbol, periods]);
  const [loaded, setLoaded] = useState<{ qs: string; items: SimilarItem[] } | null>(null);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    fetch(`/api/similar?${qs}`)
      .then((r) => r.json())
      .then((j) => !cancelled && setLoaded({ qs, items: Array.isArray(j.items) ? j.items : [] }))
      .catch(() => !cancelled && setLoaded({ qs, items: [] }));
    return () => {
      cancelled = true;
    };
  }, [eligible, qs]);

  const items = eligible && loaded?.qs === qs ? loaded.items : [];
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-t`} className="card mt-4 rounded-2xl border border-line bg-surface p-3.5">
      <h2 id={`${id}-t`} className="text-sm font-semibold">
        Prodotti simili per tipo e volatilità
      </h2>
      <p className="mt-0.5 text-xs text-muted">{SIMILAR_RULE}</p>
      <ul className="mt-3 space-y-3">
        {items.map((it) => (
          <li key={it.symbol} className="min-w-0 rounded-xl border border-line p-3">
            <p className="text-sm font-medium">{it.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              ISIN {it.isin} · TER {fmtPct(it.ter, 2)} · Volatilità {fmtPct(it.vol, 1)}
            </p>
            <p className="text-xs text-muted">
              Commissioni: ingresso {feeText(it.entryFee)}, uscita {feeText(it.exitFee)}
            </p>
            <div className="mt-1.5">
              <Outcome label="Periodo intero" amount={amount} ratio={it.growth.full} item={it} />
              <Outcome label="Ultimi 12 mesi" amount={amount} ratio={it.growth.year} item={it} />
              {it.distribution === 'dist' && <p className="text-xs text-muted">(proventi reinvestiti)</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Stesse date dello strumento analizzato. Simulazione sui prezzi storici; imposte e cambio non inclusi.</p>
    </section>
  );
}
