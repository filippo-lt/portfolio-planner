import type { ReactNode } from 'react';
import { terCostPerYear } from '@/lib/costs';
import { NA } from '@/lib/profileFit';
import { fmtEur, fmtPct } from '@/lib/format';
import { terTone } from '@/lib/tone';
import { TONE_TEXT, TonePill, cx } from './ui';

const BADGE = { good: 'Costo basso', worry: 'Costo alto', bad: 'Costo molto alto', neutral: undefined } as const;

function Side({ title, ter, amount, isStock, children }: { title: string; amount: number; ter: number | undefined; isStock?: boolean; children?: ReactNode }) {
  const tone = terTone(ter);
  const cost = terCostPerYear(amount, ter);
  const missing = ter === undefined;
  return (
    <div className="min-w-0">
      <dt className="text-sm leading-snug text-muted">{title}</dt>
      <dd
        className={cx(
          'mt-1 tabular-nums',
          missing ? 'text-base font-medium text-muted' : cx('text-[1.75rem] font-semibold leading-tight tracking-tight', TONE_TEXT[tone]),
        )}
      >
        {isStock ? 'Non previsto' : missing ? NA : fmtPct(ter, 2)}
      </dd>
      {!isStock && !missing && BADGE[tone] && (
        <dd className="mt-1.5">
          <TonePill tone={tone}>{BADGE[tone]}</TonePill>
        </dd>
      )}
      <dd className="mt-1.5 text-xs text-muted">
        {isStock
          ? 'Il TER si applica ai fondi e agli ETF, non alle azioni.'
          : cost === undefined
            ? NA
            : `Su ${fmtEur(amount)} il TER costa circa ${fmtEur(cost)} all'anno`}
      </dd>
      {children}
    </div>
  );
}

/** Cost card: fund and reference TER side by side. Entry/exit fee rows go in each side's slot. */
export function CostBlock({
  fundTer,
  benchTer,
  amount,
  isStock,
  benchLabel,
  fundExtra,
  benchExtra,
}: {
  fundTer: number | undefined;
  benchTer: number | undefined;
  /** User amount in euros */
  amount: number;
  isStock: boolean;
  benchLabel?: string;
  /** Extra rows under the fund / reference figures (fees) */
  fundExtra?: ReactNode;
  benchExtra?: ReactNode;
}) {
  return (
    <div className="card mt-4 rounded-2xl border border-line bg-surface p-3.5">
      <h2 className="text-sm font-semibold">Costo annuo (TER)</h2>
      <p className="mt-0.5 text-xs text-muted">Spese correnti, già incluse nel prezzo.</p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Side title="Questo strumento" amount={amount} ter={fundTer} isStock={isStock}>
          {fundExtra}
        </Side>
        <Side title={benchLabel ? `Riferimento · ${benchLabel}` : 'Riferimento'} ter={benchTer} amount={amount}>
          {benchExtra}
        </Side>
      </dl>
    </div>
  );
}
