// PROTOTYPE (throwaway): layer-1 variants for wayfinder ticket "What does layer 1 look like?"
'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Report } from '@/lib/report';
import { PrototypeSwitcher, type SwitcherVariant } from '../PrototypeSwitcher';
import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';
import { DEFAULT_AMOUNT, computeTrueCost, parseAmount } from './trueCostProto';

const VARIANTS: SwitcherVariant[] = [
  { key: 'A', label: 'A (Frase prima)' },
  { key: 'B', label: 'B (Banda costi cumulata)' },
  { key: 'C', label: 'C (Scontrino)' },
];

/** Renders the chosen layer-1 variant (?variant=A|B|C, default A) above the existing report. */
export function Layer1Proto({ report }: { report: Report }) {
  const raw = useSearchParams().get('variant')?.toUpperCase();
  const current = VARIANTS.some((v) => v.key === raw) ? (raw as string) : 'A';
  const [amountText, setAmountText] = useState('10.000');
  const parsed = parseAmount(amountText);
  const amount = parsed ?? DEFAULT_AMOUNT;
  const calc = useMemo(() => computeTrueCost(report, amount), [report, amount]);
  const props = { calc, amountText, onAmountText: setAmountText, amountValid: parsed !== undefined, name: report.instrument.name };

  return (
    <section aria-label="Costo reale (prototipo)" className="mt-6">
      {current === 'A' && <VariantA {...props} />}
      {current === 'B' && <VariantB {...props} />}
      {current === 'C' && <VariantC {...props} />}
      <PrototypeSwitcher variants={VARIANTS} current={current} />
    </section>
  );
}
