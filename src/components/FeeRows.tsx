'use client';

import { useId, useState } from 'react';
import { FEE_SOURCE_LABEL, feeToInput, parseFeeInput, type EffectiveFees, type UserFees } from '@/lib/fees';
import { fmtPct } from '@/lib/format';
import type { FeeValue } from '@/lib/data/types';
import { cx } from './ui';

function FeeValueText({ fee }: { fee: FeeValue | undefined }) {
  if (!fee) return <span className="text-muted">non disponibile</span>;
  const label = FEE_SOURCE_LABEL[fee.source];
  return (
    <span tabIndex={0} title={label} className="cursor-help underline decoration-dotted underline-offset-2 focus-visible:rounded">
      {fmtPct(fee.value, 2)}
      <span className="sr-only"> ({label})</span>
    </span>
  );
}

function FeeInput({ label, stored, onSave }: { label: string; stored: number | undefined; onSave: (v: number | undefined) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | undefined>();
  const text = draft ?? feeToInput(stored);
  const parsed = parseFeeInput(text);
  return (
    <div className="mt-1.5">
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        value={text}
        inputMode="decimal"
        autoComplete="off"
        maxLength={6}
        placeholder="es. 1,5"
        aria-invalid={!parsed.ok}
        aria-describedby={parsed.ok ? undefined : `${id}-err`}
        onChange={(e) => {
          setDraft(e.target.value);
          const r = parseFeeInput(e.target.value);
          if (r.ok) onSave(r.value);
        }}
        onBlur={() => setDraft(undefined)}
        className={cx('mt-0.5 h-9 w-full rounded-lg border bg-surface px-2 text-sm tabular-nums focus:border-accent', parsed.ok ? 'border-line-strong/60' : 'border-error')}
      />
      {!parsed.ok && (
        <p id={`${id}-err`} className="mt-0.5 text-xs text-error">
          Inserisci un valore tra 0 e 10.
        </p>
      )}
    </div>
  );
}

/** Entry/exit (and performance, when present) fees for one side of the cost block. */
export function FeeRows({
  fees,
  dataMissing,
  userFees,
  onUserFees,
}: {
  fees: EffectiveFees;
  /** Which fees the data lacks; manual inputs are offered only for those */
  dataMissing?: { entry: boolean; exit: boolean };
  userFees?: UserFees;
  onUserFees?: (f: UserFees) => void;
}) {
  const canEdit = !!onUserFees && !!dataMissing;
  return (
    <div className="mt-3 border-t border-line pt-2 text-sm">
      <dl className="space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Commissione di ingresso</dt>
          <dd className="tabular-nums">
            <FeeValueText fee={fees.entry} />
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Commissione di uscita</dt>
          <dd className="tabular-nums">
            <FeeValueText fee={fees.exit} />
          </dd>
        </div>
        {fees.performance && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Commissione di performance</dt>
            <dd className="tabular-nums">
              <FeeValueText fee={fees.performance} />
            </dd>
          </div>
        )}
      </dl>
      {canEdit && dataMissing.entry && (
        <FeeInput label="Commissione di ingresso %" stored={userFees?.entry} onSave={(v) => onUserFees({ ...userFees, entry: v })} />
      )}
      {canEdit && dataMissing.exit && (
        <FeeInput label="Commissione di uscita %" stored={userFees?.exit} onSave={(v) => onUserFees({ ...userFees, exit: v })} />
      )}
    </div>
  );
}
