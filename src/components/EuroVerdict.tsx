'use client';

import { useId, useState, type ReactNode } from 'react';
import type { RebasedPoint } from '@/lib/metrics';
import type { PricePoint } from '@/lib/data/types';
import type { EffectiveFees } from '@/lib/fees';
import { ACC_LABEL, DIST_LABEL, DIST_UNKNOWN, DIVIDENDS_UNKNOWN, type Distribution } from '@/lib/distribution';
import type { DistData } from '@/lib/report';
import { NA } from '@/lib/profileFit';
import { fmtDate, fmtEur } from '@/lib/format';
import { lastYearStart, parseSimAmount, simulate, terCostEstimate, type SimResult } from '@/lib/simulation';
import { TONE_TEXT, cx, signTone } from './ui';

export interface EuroSide {
  prices: PricePoint[];
  fees: EffectiveFees;
  ter: number | undefined;
  currency: string | undefined;
  distribution?: Distribution;
  /** Raw closes and payments for a distributing product; absent means the adjusted series is used */
  dist?: DistData;
}

/** Chart points are proportional to the prices, which is all a growth simulation needs. */
export const chartSeries = (chart: RebasedPoint[], key: 'a' | 'b'): PricePoint[] => chart.map((p) => ({ date: p.date, close: p[key] }));

const gainText = (g: number) => {
  const r = Math.round(g);
  return r > 0 ? `Guadagno: ${fmtEur(r)}` : r < 0 ? `Perdita: ${fmtEur(-r)}` : 'Nessuna variazione';
};

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

function Result({ title, amount, sim }: { title: string; amount: number; sim: SimResult | undefined }) {
  if (!sim) return <p className="mt-1 text-sm text-muted">{title}: {NA}</p>;
  const { entry, exit } = sim.feesIncluded;
  const feeText = !entry && !exit ? 'non incluse' : `${fmtEur(sim.entryFeeEur + sim.exitFeeEur)}${entry && exit ? '' : entry ? ' (solo ingresso)' : ' (solo uscita)'}`;
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">
        {title} · {fmtDate(sim.startDate)} – {fmtDate(sim.endDate)}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">
        {fmtEur(amount)} → {fmtEur(sim.netValue)}
      </p>
      <p className={cx('text-sm font-medium', TONE_TEXT[signTone(Math.round(sim.gainEur))])}>{gainText(sim.gainEur)}</p>
      <dl className="mt-1.5 space-y-0.5 text-xs">
        <Line label="Valore lordo">{fmtEur(sim.grossValue)}</Line>
        {sim.dividendsEur !== undefined && <Line label="di cui cedole/dividendi incassati">{fmtEur(sim.dividendsEur)}</Line>}
        <Line label="Commissioni">{feeText}</Line>
        <Line label="Valore netto">{fmtEur(sim.netValue)}</Line>
      </dl>
    </div>
  );
}

function Column({ title, amount, side }: { title: string; amount: number; side: EuroSide | undefined }) {
  if (!side) {
    return (
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted">{NA}</p>
      </div>
    );
  }
  const base = { amount, prices: side.prices, entryFee: side.fees.entry?.value, exitFee: side.fees.exit?.value, rawPrices: side.dist?.raw, dividends: side.dist?.dividends };
  const full = simulate(base);
  const year = simulate({ ...base, from: lastYearStart(side.prices) });
  const policy = side.distribution === 'acc' ? ACC_LABEL : side.distribution === 'dist' ? DIST_LABEL : DIST_UNKNOWN;
  const ter = full ? terCostEstimate(amount, side.ter, full.years) : undefined;
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-xs text-muted">{policy}</p>
      {side.distribution === 'dist' && !side.dist && <p className="text-xs text-muted">{DIVIDENDS_UNKNOWN}</p>}
      {side.distribution === 'acc' && <p className="text-xs text-muted">Proventi reinvestiti nel prezzo.</p>}
      <Result title="Periodo intero" amount={amount} sim={full} />
      <Result title="Ultimi 12 mesi" amount={amount} sim={year} />
      {ter !== undefined && <p className="text-xs text-muted">TER nel periodo intero: circa {fmtEur(ter)}, già incluso nel prezzo.</p>}
    </div>
  );
}

/** "What do I take home?": the user amount grown over the common period and the last 12 months, with entry/exit fees. */
export function EuroVerdict({
  amount,
  onAmount,
  fund,
  reference,
  referenceLabel,
}: {
  amount: number;
  onAmount: (v: number) => void;
  fund: EuroSide;
  /** Undefined when no reference is chosen or it has no data */
  reference: EuroSide | undefined;
  referenceLabel?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | undefined>();
  const text = draft ?? String(amount).replace('.', ',');
  const invalid = draft !== undefined && parseSimAmount(draft) === undefined;
  const currencies = [...new Set([fund.currency, reference?.currency].filter((c): c is string => !!c && c !== 'EUR'))];
  return (
    <section aria-labelledby={`${id}-t`} className="card mt-4 rounded-2xl border border-line bg-surface p-3.5">
      <h2 id={`${id}-t`} className="text-sm font-semibold">
        Cosa ottieni in euro
      </h2>
      <p className="mt-0.5 text-xs text-muted">Simulazione sui prezzi storici: i risultati passati non indicano quelli futuri.</p>
      <label htmlFor={id} className="mt-3 block text-xs text-muted">
        Importo investito (€)
      </label>
      <input
        id={id}
        value={text}
        inputMode="decimal"
        autoComplete="off"
        maxLength={12}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-err` : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseSimAmount(e.target.value);
          if (v !== undefined) onAmount(v);
        }}
        onBlur={() => setDraft(undefined)}
        className="mt-1 h-11 w-40 rounded-xl border border-line-strong/60 bg-surface px-3 text-base tabular-nums focus:border-accent"
      />
      {invalid && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-error">
          Inserisci un importo tra 1 e 10.000.000 €.
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Column title="Questo strumento" amount={amount} side={fund} />
        <Column title={referenceLabel ? `Riferimento · ${referenceLabel}` : 'Riferimento'} amount={amount} side={reference} />
      </div>
      {currencies.length > 0 && (
        <p className="mt-3 text-xs text-muted">Valori nella valuta di quotazione ({currencies.join(', ')}): conversione non inclusa</p>
      )}
      <p className="mt-2 text-xs text-muted">Commissioni: solo quelle di ingresso e uscita disponibili. Imposte e cambio non inclusi.</p>
    </section>
  );
}
