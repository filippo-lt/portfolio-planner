'use client';

import { useEffect, useState } from 'react';
import type { Report } from '@/lib/report';
import type { FitStatement, Knowledge } from '@/lib/profileFit';
import { summaryReport } from '@/lib/summaryPayload';
import { SIGNED_PCT_RULES, ToneText } from './ui';

const DEBOUNCE_MS = 600;
/** Successful summaries by key, so going back to a level or benchmark already seen costs no request */
const SUMMARY_CACHE = new Map<string, string>();

export function AiSummary({ report, fit, level, onSettle }: { report: Report; fit: FitStatement[]; level: Knowledge; onSettle?: () => void }) {
  const key = `${report.generatedAt}|${level}|${fit.map((f) => f.text).join('|')}`;
  const [state, setState] = useState<{ key: string; summary: string | null } | null>(null);

  const hit = SUMMARY_CACHE.get(key);
  const current = hit !== undefined ? { key, summary: hit } : state;

  useEffect(() => {
    let cancelled = false;
    // Debounce: quick level/benchmark changes produce a single request; answers already seen are reused
    if (SUMMARY_CACHE.has(key)) return;
    const timer = setTimeout(() => {
      fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: summaryReport(report), fit, level }),
      })
        .then((r) => r.json())
        .then((j) => {
          const summary = typeof j.summary === 'string' ? j.summary : null;
          if (summary) SUMMARY_CACHE.set(key, summary);
          if (!cancelled) {
            setState({ key, summary });
            requestAnimationFrame(() => onSettle?.());
          }
        })
        .catch(() => !cancelled && setState({ key, summary: null }));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (current?.key === key && !current.summary) return null; // not configured or not validated: hidden
  return (
    <section aria-labelledby="h-ai" className="card mt-8 rounded-2xl border border-accent/20 bg-gradient-to-br from-accent-soft/70 to-surface p-4">
      <h2 id="h-ai" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-accent">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 text-accent">
          <path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6L10 2.5Z" fill="currentColor" />
        </svg>
        In sintesi
      </h2>
      {current?.key === key ? (
        <>
          <p className="mt-2 leading-relaxed">
            <ToneText text={current.summary ?? ''} rules={SIGNED_PCT_RULES} />
          </p>
          <p className="mt-2 text-xs text-muted">
            Testo generato automaticamente (AI) a partire dai soli numeri di questo report; i valori sono verificati sui dati.
          </p>
        </>
      ) : (
        <div role="status" aria-label="Riepilogo in preparazione" className="mt-3 space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-11/12" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      )}
    </section>
  );
}
