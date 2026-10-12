'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AssetClass, PricePoint } from '@/lib/data/types';
import { NA } from '@/lib/profileFit';
import { fmtEur, fmtPct } from '@/lib/format';
import { applyGrowth } from '@/lib/simulation';
import { Chip, Disclosure } from './ui';
import { SIMILAR_RULE, fundPeriods, type SimilarItem } from '@/lib/similar';

const feeText = (v: number | undefined) => (v === undefined ? 'non inclusa' : fmtPct(v, 2));

function Outcome({ label, amount, ratio, item }: { label: string; amount: number; ratio: number | undefined; item: SimilarItem }) {
  const r = ratio === undefined ? undefined : applyGrowth(amount, ratio, item.entryFee, item.exitFee);
  return (
    <p className="text-sm tabular-nums">
      <span className="text-xs text-muted">{label}: </span>
      {r ? `${fmtEur(amount)} → ${fmtEur(r.netValue)}` : ratio === undefined && label === 'Periodo intero' ? 'Storico più breve: periodo intero non confrontabile' : NA}
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
  referenceSymbol,
}: {
  symbol: string;
  assetClass: AssetClass;
  volatility: number | undefined;
  /** The series the euro box simulates for the fund: the similar products use the same dates */
  prices: PricePoint[];
  amount: number;
  /** The reference chosen for the comparison, marked in the list */
  referenceSymbol?: string;
}) {
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
  const same = (a: string, b: string | undefined) => !!b && a.toUpperCase() === b.toUpperCase();
  return (
    <Disclosure id="h-sim" title={`Prodotti simili (${items.length})`} preview={items.slice(0, 2).map((it) => it.name).join(' · ')}>
      <p className="text-sm text-muted">{SIMILAR_RULE}</p>
      <ul className="mt-3 space-y-3">
        {items.map((it) => (
          <li key={it.symbol} className="min-w-0 rounded-xl border border-line p-3">
            <p className="text-sm font-medium">
              {it.name}
              {same(it.symbol, referenceSymbol) && (
                <span className="ml-2 align-middle">
                  <Chip tone="accent">Riferimento attuale</Chip>
                </span>
              )}
              {same(it.symbol, symbol) && (
                <span className="ml-2 align-middle">
                  <Chip>Strumento analizzato</Chip>
                </span>
              )}
            </p>
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
    </Disclosure>
  );
}
