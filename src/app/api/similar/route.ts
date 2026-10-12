import { NextResponse } from 'next/server';
import { buildSimilar, SYMBOL_RE } from '@/lib/report';
import type { Period } from '@/lib/similar';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date: 2024-02-31 matches the pattern but is not one. */
const isCalendarDate = (d: string) => {
  const t = Date.parse(d);
  return DATE_RE.test(d) && Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
};

/** Both dates valid and ordered, or undefined. */
function period(from: string | null, to: string | null): Period | undefined {
  return from && to && isCalendarDate(from) && isCalendarDate(to) && from < to ? { from, to } : undefined;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const symbol = sp.get('symbol')?.trim();
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: 'Simbolo non valido' }, { status: 400 });
  }
  const periods = { full: period(sp.get('from'), sp.get('to')), year: period(sp.get('yfrom'), sp.get('yto')) };
  try {
    return NextResponse.json({ items: await buildSimilar(symbol, periods) });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
