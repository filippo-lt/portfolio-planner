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
import { fmtDate, fmtEur, fmtNum, fmtPct } from '@/lib/format';
import { DEFAULT_FX_COST, type FxRate, fxCurrency, parseFxCost } from '@/lib/fx';
import { lastYearStart, parseSimAmount, simulate, terCostEstimate, type SimResult } from '@/lib/simulation';
import { Disclosure, TONE_TEXT, cx, signTone } from './ui';

export interface EuroSide {
  prices: PricePoint[];
  fees: EffectiveFees;
  ter: number | undefined;
  currency: string | undefined;
  distribution?: Distribution;
  /** Raw closes and payments for a distributing product; absent means the adjusted series is used */
  dist?: DistData;
  /** Non-EUR quote: currency per 1 EUR on the dates of `prices`; absent means no conversion is made */
  fx?: FxRate[];
  /** For the tax estimate */
  type?: InstrumentType;
  assetClass?: AssetClass;
  /** Government-bond share 0..1, only for curated products */
  govtShare?: number;
}

/** Chart points are proportional to the prices, which is all a growth simulation needs. */
export const chartSeries = (chart: RebasedPoint[], key: 'a' | 'b'): PricePoint[] =>
  chart.map((p) => ({ date: p.date, close: p[key] }));

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

const eurRange = (a: number, b: number) =>
  Math.round(a) === Math.round(b) ? fmtEur(a) : `da ${fmtEur(a)} a ${fmtEur(b)}`;

const isForeign = (side: EuroSide) => !!side.currency && side.currency !== 'EUR';

const taxFor = (
  sim: SimResult | undefined,
  side: EuroSide,
  amount: number,
  taxCountry: TaxCountry | undefined,
): TaxEstimate | undefined =>
  sim && side.type
    ? taxRulesFor(taxCountry)?.estimate({
        gain: sim.netValue - amount,
        type: side.type,
        assetClass: side.assetClass,
        govtShare: side.govtShare,
        distributing: sim.dividendsEur !== undefined,
      })
    : undefined;

interface SideCalc {
  side: EuroSide;
  full: SimResult | undefined;
  year: SimResult | undefined;
  taxFull: TaxEstimate | undefined;
  taxYear: TaxEstimate | undefined;
  dividendsMissing: boolean;
  policy: string;
  ter: number | undefined;
}

function calcSide(side: EuroSide, amount: number, fxCost: number, taxCountry: TaxCountry | undefined): SideCalc {
  const base = {
    amount,
    prices: side.prices,
    entryFee: side.fees.entry?.value,
    exitFee: side.fees.exit?.value,
    rawPrices: side.dist?.raw,
    dividends: side.dist?.dividends,
    fx: isForeign(side) && side.fx ? { rates: side.fx, cost: fxCost } : undefined,
  };
  const full = simulate(base);
  const year = simulate({ ...base, from: lastYearStart(side.prices) });
  return {
    side,
    full,
    year,
    taxFull: taxFor(full, side, amount, taxCountry),
    taxYear: taxFor(year, side, amount, taxCountry),
    dividendsMissing:
      side.distribution === 'dist' && (!side.dist || [full, year].some((r) => r && r.dividendsEur === undefined)),
    policy:
      side.type === 'STOCK'
        ? 'Dividendi reinvestiti nel prezzo.'
        : side.distribution === 'acc'
          ? `${ACC_LABEL}: proventi reinvestiti nel prezzo`
          : side.distribution === 'dist'
            ? DIST_LABEL
            : DIST_UNKNOWN,
    ter: full ? terCostEstimate(amount, side.ter, full.years) : undefined,
  };
}

/** The answer in two lines: what the amount became over the whole period and over the last 12 months. */
function Headline({ title, sim, tax }: { title: string; sim: SimResult | undefined; tax: TaxEstimate | undefined }) {
  if (!sim)
    return (
      <p className="text-sm text-muted">
        {title}: {NA}
      </p>
    );
  return (
    <div>
      <p className="text-sm text-muted">
        {title} · {fmtDate(sim.startDate)} – {fmtDate(sim.endDate)}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{fmtEur(sim.netValue)}</p>
      <p className={cx('text-sm font-medium', TONE_TEXT[signTone(Math.round(sim.gainEur))])}>{gainText(sim.gainEur)}</p>
      {tax && (
        <p className="mt-0.5 text-sm">
          Netto dopo tasse (stima):{' '}
          <span className="font-medium tabular-nums">{eurRange(sim.netValue - tax.high, sim.netValue - tax.low)}</span>
        </p>
      )}
    </div>
  );
}

function Headlines({ title, c }: { title: string; c: SideCalc | undefined }) {
  return (
    <div className="card min-w-0 space-y-4 rounded-2xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {c ? (
        <>
          <Headline title="Periodo intero" sim={c.full} tax={c.taxFull} />
          <Headline title="Ultimi 12 mesi" sim={c.year} tax={c.taxYear} />
        </>
      ) : (
        <p className="text-sm text-muted">{NA}</p>
      )}
    </div>
  );
}

function PeriodDetail({
  title,
  sim,
  side,
  tax,
}: {
  title: string;
  sim: SimResult | undefined;
  side: EuroSide;
  tax: TaxEstimate | undefined;
}) {
  if (!sim)
    return (
      <p className="text-sm text-muted">
        {title}: {NA}
      </p>
    );
  const { entry, exit } = sim.feesIncluded;
  const feeTotal = sim.entryFeeEur + sim.exitFeeEur;
  const feeText =
    !entry && !exit
      ? 'non incluse'
      : `${fmtEur(feeTotal)}${entry && exit ? '' : entry ? ' (solo ingresso)' : ' (solo uscita)'}`;
  // Rows that repeat the headline are left out: gross equals net, or fees are included and cost nothing
  const showGross = fmtEur(sim.grossValue) !== fmtEur(sim.netValue);
  const showFees = !(entry || exit) || Math.round(feeTotal) !== 0;
  const extra = showGross || showFees || sim.dividendsEur !== undefined || !!sim.fx;
  // Nothing beyond the headline net value: no empty sub-heading
  if (!extra && !tax && !isForeign(side)) return null;
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      {extra && (
        <dl className="mt-1 space-y-1 text-sm">
          {showGross && <Line label="Valore lordo">{fmtEur(sim.grossValue)}</Line>}
          {showFees && <Line label="Commissioni">{feeText}</Line>}
          {sim.dividendsEur !== undefined && <Line label="Cedole/dividendi incassati">{fmtEur(sim.dividendsEur)}</Line>}
          {sim.fx && <Line label="Costo cambio valuta">{fmtEur(sim.fx.costEur)}</Line>}
          <Line label="Valore netto">{fmtEur(sim.netValue)}</Line>
        </dl>
      )}
      {sim.fx && side.currency && (
        <p className="mt-1 text-sm text-muted">
          Cambio EUR/{fxCurrency(side.currency)} al {fmtDate(sim.fx.startRateDate)}: {fmtNum(sim.fx.startRate, 4)} · al{' '}
          {fmtDate(sim.fx.endRateDate)}: {fmtNum(sim.fx.endRate, 4)}
        </p>
      )}
      {isForeign(side) && !sim.fx && (
        <p className="mt-1 text-sm text-muted">
          Cambio {side.currency}: {NA}, conversione non inclusa.
        </p>
      )}
      {tax && (
        <div className="mt-1">
          <dl className="text-sm">
            <Line label="Tasse (stima)">{eurRange(tax.low, tax.high)}</Line>
          </dl>
          <p className="mt-1 text-xs text-muted">Regola usata: {tax.rateLabel}.</p>
          {tax.notes.map((n) => (
            <p key={n} className="mt-0.5 text-xs text-muted">
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SideDetail({ title, c }: { title: string; c: SideCalc | undefined }) {
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {c ? (
        <>
          <p className="text-sm text-muted">{c.policy}</p>
          {c.dividendsMissing && <p className="text-sm text-muted">{DIVIDENDS_UNKNOWN}</p>}
          <PeriodDetail title="Periodo intero" sim={c.full} side={c.side} tax={c.taxFull} />
          <PeriodDetail title="Ultimi 12 mesi" sim={c.year} side={c.side} tax={c.taxYear} />
          {c.ter !== undefined && (
            <p className="text-sm text-muted">TER nel periodo intero: circa {fmtEur(c.ter)}, già incluso nel prezzo.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">{NA}</p>
      )}
    </div>
  );
}

/** "What would I have today?": the user amount grown over the common period and the last 12 months, with entry/exit fees. */
export function EuroVerdict({
  amount,
  onAmount,
  fund,
  reference,
  referenceLabel,
  referenceNote,
  taxCountry,
  fxCost = DEFAULT_FX_COST,
  onFxCost,
  fxCostIsUser = false,
}: {
  amount: number;
  onAmount: (v: number) => void;
  fund: EuroSide;
  /** Undefined when no reference is chosen or it has no data */
  reference: EuroSide | undefined;
  referenceLabel?: string;
  /** Shown instead of the reference card when there is nothing to compare (e.g. the reference is the instrument itself) */
  referenceNote?: string;
  taxCountry?: TaxCountry;
  /** Spread per currency conversion, fraction */
  fxCost?: number;
  onFxCost?: (v: number) => void;
  fxCostIsUser?: boolean;
}) {
  const id = useId();
  const [fxDraft, setFxDraft] = useState<string | undefined>();
  const fxText = fxDraft ?? String(Math.round(fxCost * 10000) / 100).replace('.', ',');
  const fxInvalid = fxDraft !== undefined && parseFxCost(fxDraft) === undefined;
  const [draft, setDraft] = useState<string | undefined>();
  const text = draft ?? String(amount).replace('.', ',');
  const invalid = draft !== undefined && parseSimAmount(draft) === undefined;
  const foreign = [fund, reference].filter((x): x is EuroSide => !!x && isForeign(x));
  const currencies = [...new Set(foreign.map((x) => x.currency!))];
  // Conversion is missing for the products that have no rates (shown with the old note).
  const unconverted = [...new Set(foreign.filter((x) => !x.fx).map((x) => x.currency!))];
  const converted = foreign.some((x) => x.fx);
  const fundCalc = calcSide(fund, amount, fxCost, taxCountry);
  const refCalc = reference ? calcSide(reference, amount, fxCost, taxCountry) : undefined;
  const refTitle = referenceLabel ? `Riferimento · ${referenceLabel}` : 'Riferimento';
  return (
    <section id="h-euro" aria-labelledby={`${id}-t`} className="mt-8 scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 id={`${id}-t`} className="text-lg font-semibold tracking-tight">
          Quanto avresti oggi con {fmtEur(amount)}
        </h2>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label htmlFor={id} className="text-sm text-muted">
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
      </div>
      {invalid && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-error">
          Inserisci un importo tra 1 e 10.000.000 €.
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Headlines title="Questo strumento" c={fundCalc} />
        {refCalc || !referenceNote ? (
          <Headlines title={refTitle} c={refCalc} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-4 text-sm text-muted">
            {referenceNote}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Simulazione sui prezzi storici: i risultati passati non indicano quelli futuri.
        {!taxRulesFor(taxCountry) &&
          (taxCountry === 'OTHER' ? (
            ' Tasse non incluse: paese non ancora supportato.'
          ) : (
            <>
              {' '}
              Tasse non incluse ·{' '}
              <Link href="/profilo" className="font-medium text-accent underline underline-offset-2">
                Imposta la residenza fiscale
              </Link>
            </>
          ))}
      </p>
      {currencies.length > 0 && onFxCost && (
        <Disclosure
          variant="sub"
          title="Costo di cambio"
          preview={`${fmtPct(fxCost, 2)} (${fxCostIsUser ? 'inserito da te' : 'stima tipica broker'}) · Modifica`}
          forceOpen={fxInvalid}
        >
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-fx`} className="text-sm text-muted">
              Costo cambio %
            </label>
            <input
              id={`${id}-fx`}
              value={fxText}
              inputMode="decimal"
              autoComplete="off"
              maxLength={5}
              aria-invalid={fxInvalid}
              aria-describedby={`${id}-fxn`}
              onChange={(e) => {
                setFxDraft(e.target.value);
                const v = parseFxCost(e.target.value);
                if (v !== undefined) onFxCost(v);
              }}
              onBlur={() => setFxDraft(undefined)}
              className="h-11 w-24 rounded-xl border border-line-strong/60 bg-surface px-3 text-base tabular-nums focus:border-accent"
            />
          </div>
          <p
            id={`${id}-fxn`}
            className={cx('mt-1 text-xs', fxInvalid ? 'text-error' : 'text-muted')}
            role={fxInvalid ? 'alert' : undefined}
          >
            {fxInvalid
              ? 'Inserisci un valore tra 0 e 5.'
              : `Applicato a ogni conversione, all'andata e al ritorno (${fmtPct(fxCost, 2)}): ${fxCostIsUser ? 'inserito da te' : 'valore predefinito (stima tipica broker)'}.`}
          </p>
        </Disclosure>
      )}
      <Disclosure variant="sub" title="Dettaglio del calcolo">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <SideDetail title="Questo strumento" c={fundCalc} />
          {(refCalc || !referenceNote) && <SideDetail title={refTitle} c={refCalc} />}
        </div>
        {unconverted.length > 0 && (
          <p className="mt-4 text-xs text-muted">
            Cambio {unconverted.map((c) => `EUR/${fxCurrency(c)}`).join(', ')}: {NA}. Valori nella valuta di quotazione
            ({unconverted.join(', ')}): conversione non inclusa
          </p>
        )}
        {converted && (
          <p className="mt-3 text-xs text-muted">
            Conversione EUR → valuta di quotazione → EUR con il cambio più recente disponibile entro 7 giorni dalla
            data; cedole e dividendi sono convertiti al cambio finale (semplificazione).
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          Commissioni: solo quelle di ingresso e uscita disponibili.{' '}
          {currencies.length > 0 && !converted ? 'Cambio non incluso; ' : ''}Le tasse sono una stima, solo se hai
          indicato la residenza fiscale.
        </p>
      </Disclosure>
    </section>
  );
}
