import type { ReactNode } from 'react';
import { terCostPerYear } from '@/lib/costs';
import { NA } from '@/lib/profileFit';
import { fmtEur, fmtPct } from '@/lib/format';
import { terTone } from '@/lib/tone';
import type { EffectiveFees } from '@/lib/fees';
import { Disclosure, TONE_TEXT, TonePill, cx } from './ui';

export const TER_BADGE = {
  good: 'Costo basso',
  worry: 'Costo alto',
  bad: 'Costo molto alto',
  neutral: undefined,
} as const;

function Side({ title, ter, amount }: { title: string; amount: number; ter: number | undefined }) {
  const tone = terTone(ter);
  const cost = terCostPerYear(amount, ter);
  const missing = ter === undefined;
  return (
    <div className="min-w-0">
      <dt className="text-sm leading-snug text-muted">{title}</dt>
      <dd
        className={cx(
          'mt-1 tabular-nums',
          missing
            ? 'text-base font-medium text-muted'
            : cx('text-[1.75rem] leading-tight font-semibold tracking-tight', TONE_TEXT[tone]),
        )}
      >
        {missing ? 'TER non disponibile' : fmtPct(ter, 2)}
      </dd>
      {!missing && TER_BADGE[tone] && (
        <dd className="mt-1.5">
          <TonePill tone={tone}>{TER_BADGE[tone]}</TonePill>
        </dd>
      )}
      <dd className="mt-1.5 text-sm text-muted">
        {cost === undefined ? NA : `Su ${fmtEur(amount)} il TER costa circa ${fmtEur(cost)} all'anno`}
      </dd>
    </div>
  );
}

const feePct = (f: EffectiveFees['entry']) => (f ? fmtPct(f.value, 2) : 'n.d.');

/** Collapsed cost block: fund and reference TER side by side. Entry/exit fee rows go in each side's slot. */
export function CostBlock({
  fundTer,
  benchTer,
  amount,
  fees,
  benchLabel,
  defaultOpen,
  fundExtra,
  benchExtra,
}: {
  fundTer: number | undefined;
  benchTer: number | undefined;
  /** User amount in euros */
  amount: number;
  /** The fund's effective fees, for the collapsed summary */
  fees: EffectiveFees;
  benchLabel?: string;
  /** Open from the start when a fee is missing and can be entered, or a performance fee changes the result */
  defaultOpen?: boolean;
  /** Extra rows under the fund / reference figures (fees) */
  fundExtra?: ReactNode;
  benchExtra?: ReactNode;
}) {
  const cost = terCostPerYear(amount, fundTer);
  const preview = `${fundTer === undefined ? 'TER non disponibile' : `TER ${fmtPct(fundTer, 2)}${cost === undefined ? '' : ` (≈ ${fmtEur(cost)} l'anno su ${fmtEur(amount)})`}`} · ingresso ${feePct(fees.entry)} · uscita ${feePct(fees.exit)}`;
  return (
    <Disclosure id="h-cost" title="Costi e commissioni" preview={preview} defaultOpen={defaultOpen}>
      <p className="text-sm text-muted">
        Spese correnti, già incluse nel prezzo.{benchLabel ? ` Riferimento: ${benchLabel}.` : ''}
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Side title="Questo strumento" amount={amount} ter={fundTer} />
        <Side title="Riferimento" ter={benchTer} amount={amount} />
      </dl>
      {(fundExtra || benchExtra) && (
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div className="min-w-0">{fundExtra}</div>
          <div className="min-w-0">{benchExtra}</div>
        </div>
      )}
    </Disclosure>
  );
}
