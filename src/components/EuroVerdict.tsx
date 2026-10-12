'use client';

import { useId, useState, type ReactNode } from 'react';
import type { RebasedPoint } from '@/lib/metrics';
import type { AssetClass, InstrumentType, PricePoint } from '@/lib/data/types';
import { taxRulesFor, type TaxCountry, type TaxEstimate } from '@/lib/tax';
import Link from 'next/link';
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
  /** For the tax estimate */
  type?: InstrumentType;
  assetClass?: AssetClass;
  /** Government-bond share 0..1, only for curated products */
  govtShare?: number;
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

const eurRange = (a: number, b: number) => (Math.round(a) === Math.round(b) ? fmtEur(a) : `da ${fmtEur(a)} a ${fmtEur(b)}`);

/** Tax lines under the result; without supported rules the box says so and points to the profile. */
function TaxLines({ sim, tax, taxCountry }: { sim: SimResult; tax: TaxEstimate | undefined; taxCountry: TaxCountry | undefined }) {
  if (!tax) {
    return (
      <p className="mt-1.5 text-xs text-muted">
        Tasse non incluse ·{' '}
        <Link href="/profilo" className="font-medium text-accent underline underline-offset-2">
          Imposta la residenza fiscale
        </Link>
        {taxCountry && taxCountry !== 'IT' ? ' (per il tuo paese la stima non è ancora disponibile)' : ''}
      </p>
    );
  }
  const net = sim.netValue - tax.high;
  const netHigh = sim.netValue - tax.low;
  return (
    <div className="mt-1.5">
      <dl className="space-y-0.5 text-xs">
        <Line label="Tasse (stima)">{eurRange(tax.low, tax.high)}</Line>
        <Line label="Netto dopo tasse (stima)">{eurRange(net, netHigh)}</Line>
      </dl>
      <p className="mt-1 text-xs text-muted">Regola usata: {tax.rateLabel}.</p>
      {tax.notes.map((n) => (
        <p key={n} className="mt-0.5 text-xs text-muted">
          {n}
        </p>
      ))}
    </div>
  );
}

function Result({ title, amount, sim, side, taxCountry }: { title: string; amount: number; sim: SimResult | undefined; side: EuroSide; taxCountry: TaxCountry | undefined }) {
  if (!sim) return <p className="mt-1 text-sm text-muted">{title}: {NA}</p>;
  const { entry, exit } = sim.feesIncluded;
  const tax = side.type
    ? taxRulesFor(taxCountry)?.estimate({ gain: sim.netValue - amount, type: side.type, assetClass: side.assetClass, govtShare: side.govtShare, distributing: sim.dividendsEur !== undefined })
    : undefined;
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
      <TaxLines sim={sim} tax={tax} taxCountry={taxCountry} />
    </div>
  );
}

function Column({ title, amount, side, taxCountry }: { title: string; amount: number; side: EuroSide | undefined; taxCountry: TaxCountry | undefined }) {
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
      <Result title="Periodo intero" amount={amount} sim={full} side={side} taxCountry={taxCountry} />
      <Result title="Ultimi 12 mesi" amount={amount} sim={year} side={side} taxCountry={taxCountry} />
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
  taxCountry,
}: {
  amount: number;
  onAmount: (v: number) => void;
  fund: EuroSide;
  /** Undefined when no reference is chosen or it has no data */
  reference: EuroSide | undefined;
  referenceLabel?: string;
  taxCountry?: TaxCountry;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | undefined>();
  const text = draft ?? String(amount).replace('.', ',');
  const invalid = draft !== undefined && parseSimAmount(draft) === undefined;
  const currencies = [...new Set([fund.currency, reference?.currency].filter((c): c is string => !!c && c !== 'EUR'))];
  return (
    <section aria-labelledby={`${id}-t`} className="card mt-3 rounded-2xl border border-line bg-surface p-3.5">
      <h2 id={`${id}-t`} className="text-sm font-semibold">
        Cosa ottieni in euro
      </h2>
      <p className="mt-0.5 text-xs text-muted">Simulazione sui prezzi storici: i risultati passati non indicano quelli futuri.</p>
      <div className="mt-2 flex items-center gap-2">
        <label htmlFor={id} className="text-xs text-muted">
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
          className="h-11 w-32 rounded-xl border border-line-strong/60 bg-surface px-3 text-base tabular-nums focus:border-accent"
        />
      </div>
      {invalid && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-error">
          Inserisci un importo tra 1 e 10.000.000 €.
        </p>
      )}
      {referenceLabel && (
        <p className="mt-1 text-xs text-muted">
          Riferimento: {referenceLabel} ·{' '}
          <a href="#h-bench" className="font-medium text-accent underline underline-offset-2">
            Cambia
          </a>
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Column title="Questo strumento" amount={amount} side={fund} taxCountry={taxCountry} />
        <Column title={referenceLabel ? `Riferimento · ${referenceLabel}` : 'Riferimento'} amount={amount} side={reference} taxCountry={taxCountry} />
      </div>
      {currencies.length > 0 && (
        <p className="mt-3 text-xs text-muted">Valori nella valuta di quotazione ({currencies.join(', ')}): conversione non inclusa</p>
      )}
      <p className="mt-2 text-xs text-muted">Commissioni: solo quelle di ingresso e uscita disponibili. Cambio non incluso; le tasse sono una stima, solo se hai indicato la residenza fiscale.</p>
    </section>
  );
}
