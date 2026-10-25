// PROTOTYPE (throwaway): layer-1 variants for wayfinder ticket "What does layer 1 look like?"
'use client';

import type { ReactNode } from 'react';
import { fmtDate, fmtEur, fmtPct } from '@/lib/format';
import { NA } from '@/lib/profileFit';
import { cx } from '../ui';
import { BANK_ITEM, BOLLO_RATE, TAX_RATE, type ProtoCalc, type ProtoNo, type ProtoOk } from './trueCostProto';

export interface VariantProps {
  calc: ProtoCalc;
  amountText: string;
  onAmountText: (s: string) => void;
  amountValid: boolean;
  name: string;
}

export type FocusKey = 'running' | 'fees' | 'bollo' | 'tax' | 'bank';

export function AmountInput({ value, onChange, valid, className }: { value: string; onChange: (s: string) => void; valid: boolean; className?: string }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label="Importo investito, in euro"
      aria-invalid={!valid}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: `${Math.max(4, value.length + 1)}ch` }}
      className={cx(
        'rounded-md border-b-2 bg-accent-soft/60 px-1 text-center font-semibold tabular-nums text-accent outline-none focus:bg-accent-soft',
        valid ? 'border-accent' : 'border-error',
        className,
      )}
    />
  );
}

/** "Su [10.000] € in 10 anni hai pagato X di costi e Z di tasse" */
export function HeadlineSentence({ calc, amountText, onAmountText, amountValid, className }: VariantProps & { className?: string }) {
  if (!calc.ok) {
    return (
      <div className={className}>
        <p className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {calc.reason === 'ter' ? NA : 'Costo reale non calcolabile'}
        </p>
        <p className="mt-1 text-sm text-muted">{calc.reason === 'ter' ? 'Costi correnti (TER): dato non disponibile per questo prodotto.' : calc.message}</p>
      </div>
    );
  }
  return (
    <div className={className}>
      <h2 className="text-balance font-semibold leading-snug tracking-tight">
        Su <AmountInput value={amountText} onChange={onAmountText} valid={amountValid} className="text-[1em]" /> € in {calc.windowLabel} hai pagato{' '}
        <span className="whitespace-nowrap text-warn">{fmtEur(calc.costs)}</span> di costi e{' '}
        <span className="whitespace-nowrap text-error">{fmtEur(calc.tax)}</span> di tasse
        {calc.tax === 0 && <span className="text-muted"> (nessun guadagno)</span>}
      </h2>
      {!amountValid && <p className="mt-1 text-xs text-error">Importo non valido: calcolo su {fmtEur(calc.amount)}.</p>}
      <p className="mt-1.5 text-xs text-muted">Costi correnti attuali applicati a tutto il periodo. Le tasse sono indicate a parte, non sono nei costi.</p>
    </div>
  );
}

export function NotIncluded({ calc, className }: { calc: ProtoCalc; className?: string }) {
  return (
    <p className={cx('text-sm text-muted', className)}>
      <span className="font-medium text-ink">Non inclusi:</span> {calc.notIncluded.join(', ')}
    </p>
  );
}

export function DataTile({ label, value, note, className }: { label: string; value: string; note?: string; className?: string }) {
  const na = !/\d/.test(value);
  return (
    <div className={cx('rounded-xl border border-line bg-surface p-3', className)}>
      <dt className="text-sm leading-snug text-muted">{label}</dt>
      <dd className={cx('mt-1 tabular-nums', na ? 'text-base text-muted' : 'text-xl font-semibold tracking-tight')}>{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-muted">{note}</dd>}
    </div>
  );
}

export function dataPoints(c: ProtoOk) {
  return {
    ret: { label: 'Rendimento annuo', value: fmtPct(c.annualReturn), note: `su ${c.windowLabel}, dopo i costi correnti` },
    dd: { label: 'Perdita massima', value: fmtPct(c.maxDrawdown), note: 'nel periodo, dati mensili' },
    ter: { label: 'Costi correnti', value: `${fmtPct(c.rate, 2)} l'anno`, note: `${fmtEur((c.amount * c.rate))} l'anno su ${fmtEur(c.amount)}` },
    kept: { label: 'Ti è rimasto', value: fmtEur(c.kept), note: 'dopo costi e tasse' },
  };
}

function L2Row({ k, focus, label, detail, value }: { k: FocusKey; focus?: FocusKey | null; label: string; detail?: string; value: ReactNode }) {
  return (
    <li id={`l2-${k}`} className={cx('flex items-start justify-between gap-3 px-3 py-2.5', focus === k && 'bg-accent-soft')}>
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {detail && <p className="text-sm text-muted">{detail}</p>}
      </div>
      <p className={cx('shrink-0 text-right tabular-nums', typeof value === 'string' && !/\d/.test(value) ? 'text-sm text-muted' : 'font-medium')}>{value}</p>
    </li>
  );
}

/** Layer 2 stub: cost line items. `focus` highlights one row. */
export function Layer2List({ calc, focus }: { calc: ProtoOk | ProtoNo; focus?: FocusKey | null }) {
  const c = calc.ok ? calc : undefined;
  const feeDetail = (label: string, rate?: number, eur?: number) => (rate === undefined ? `${label}: ${NA}` : `${label} ${fmtPct(rate, 2)} = ${fmtEur(eur)}`);
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      <L2Row
        focus={focus}
        k="running"
        label="Costi correnti"
        detail={c ? `${fmtPct(c.rate, 2)} l'anno, già dentro il prezzo, applicato a tutto il periodo` : 'Costi correnti (TER): dato non disponibile'}
        value={c ? fmtEur(c.running) : NA}
      />
      <L2Row
        focus={focus}
        k="fees"
        label="Commissioni d'ingresso / uscita"
        detail={c ? `${feeDetail('Ingresso', c.entryRate, c.entryFee)} · ${feeDetail('Uscita', c.exitRate, c.exitFee)}` : undefined}
        value={c && (c.entryRate !== undefined || c.exitRate !== undefined) ? fmtEur(c.fees) : NA}
      />
      <L2Row
        focus={focus}
        k="bollo"
        label="Imposta di bollo"
        detail={c ? `${fmtPct(BOLLO_RATE, 1)} del valore a ogni 31 dicembre, proporzionale nel primo e ultimo anno` : undefined}
        value={c ? fmtEur(c.bollo) : NA}
      />
      <L2Row
        focus={focus}
        k="bank"
        label="Costi della banca"
        detail="Canone, commissioni di negoziazione, custodia"
        value={<span className="text-sm font-medium text-accent">{BANK_ITEM.match(/\((.*)\)/)?.[1] ?? 'scegli la tua banca'}</span>}
      />
      <L2Row
        focus={focus}
        k="tax"
        label="Tasse (separate dai costi)"
        detail={c ? `${fmtPct(TAX_RATE, 0)} su ${fmtEur(Math.max(0, c.taxBase))} di guadagno, dopo il bollo${c.tax === 0 ? ' · nessun guadagno' : ''}` : undefined}
        value={c ? fmtEur(c.tax) : NA}
      />
    </ul>
  );
}

export function PeriodNote({ c }: { c: ProtoOk }) {
  return (
    <p className="text-xs text-muted">
      Dal {fmtDate(c.startDate)} al {fmtDate(c.endDate)} · dati mensili · calcolo semplificato, tasse al 26%.
    </p>
  );
}
