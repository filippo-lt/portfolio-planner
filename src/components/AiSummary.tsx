'use client';

import { useEffect, useState } from 'react';
import type { Report } from '@/lib/report';
import type { FitStatement, Knowledge } from '@/lib/profileFit';

export function AiSummary({ report, fit, level }: { report: Report; fit: FitStatement[]; level: Knowledge }) {
  const key = `${report.generatedAt}|${level}|${fit.map((f) => f.text).join('|')}`;
  const [state, setState] = useState<{ key: string; summary: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { chart: _chart, monthly: _monthly, ...slim } = report;
    void _chart;
    void _monthly;
    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: slim, fit, level }),
    })
      .then((r) => r.json())
      .then((j) => !cancelled && setState({ key, summary: typeof j.summary === 'string' ? j.summary : null }))
      .catch(() => !cancelled && setState({ key, summary: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state?.key === key && !state.summary) return null; // not configured or not validated: hidden
  return (
    <section aria-labelledby="h-ai" className="mt-8">
      <h2 id="h-ai" className="text-xl font-semibold">
        Riepilogo (AI)
      </h2>
      {state?.key === key ? (
        <>
          <p className="mt-2">{state.summary}</p>
          <p className="mt-1 text-sm text-slate-700">
            Testo generato automaticamente a partire dai soli numeri di questo report; i valori sono verificati sui dati.
          </p>
        </>
      ) : (
        <p role="status" className="mt-2 text-slate-700">
          Riepilogo in preparazione…
        </p>
      )}
    </section>
  );
}
