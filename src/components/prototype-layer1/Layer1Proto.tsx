// PROTOTYPE (throwaway): alternatives comparison for wayfinder ticket "How are a Product and its Alternatives compared, including Cost and Tax?"
// (layer 1 is always the chosen VariantA; the switcher now toggles only the alternatives comparison)
'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Report } from '@/lib/report';
import { PrototypeSwitcher, type SwitcherVariant } from '../PrototypeSwitcher';
import { VariantA } from './VariantA';
import { DEFAULT_AMOUNT, computeTrueCost, parseAmount } from './trueCostProto';
import { useAlternatives } from '../prototype-alternatives/altData';
import { AltA } from '../prototype-alternatives/AltA';
import { AltB } from '../prototype-alternatives/AltB';
import { AltC } from '../prototype-alternatives/AltC';

const VARIANTS: SwitcherVariant[] = [
  { key: 'A', label: 'A (Tabella sotto lo strato 1)' },
  { key: 'B', label: 'B (Confronti a coppie dentro lo strato 2)' },
  { key: 'C', label: 'C (Barre del costo reale, strato a sé)' },
];

/** Layer 1 (VariantA) plus the alternatives variant chosen with ?variant=A|B|C (default A). ?gap=1 forces missing data. */
export function Layer1Proto({ report }: { report: Report }) {
  const sp = useSearchParams();
  const raw = sp.get('variant')?.toUpperCase();
  const current = VARIANTS.some((v) => v.key === raw) ? (raw as string) : 'A';
  const gap = sp.get('gap') === '1';
  const [amountText, setAmountText] = useState('10.000');
  const parsed = parseAmount(amountText);
  const amount = parsed ?? DEFAULT_AMOUNT;
  const calc = useMemo(() => computeTrueCost(report, amount), [report, amount]);
  const model = useAlternatives(report, calc, amount, gap);
  const props = { calc, amountText, onAmountText: setAmountText, amountValid: parsed !== undefined, name: report.instrument.name };

  return (
    <section aria-label="Costo reale (prototipo)" className="mt-6">
      <VariantA {...props} l2Extra={current === 'B' ? <AltB model={model} /> : undefined} />
      {model.hasAlts && current === 'A' && <AltA model={model} />}
      {model.hasAlts && current === 'C' && <AltC model={model} />}
      {!model.hasAlts && <p className="mt-3 text-sm text-muted">Prototipo: nessuna alternativa configurata per {report.instrument.symbol}.</p>}
      <PrototypeSwitcher variants={VARIANTS} current={current} />
    </section>
  );
}
