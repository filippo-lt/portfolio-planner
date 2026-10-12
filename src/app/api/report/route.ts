import { NextResponse } from 'next/server';
import { buildReport, SYMBOL_RE } from '@/lib/report';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const symbol = sp.get('symbol')?.trim();
  const benchmark = sp.get('benchmark')?.trim() || undefined;
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: 'Simbolo non valido' }, { status: 400 });
  }
  if (benchmark && !SYMBOL_RE.test(benchmark)) {
    return NextResponse.json({ error: 'Benchmark non valido' }, { status: 400 });
  }
  try {
    return NextResponse.json(await buildReport(symbol, benchmark));
  } catch {
    return NextResponse.json({ error: 'Strumento non trovato o dati non disponibili' }, { status: 502 });
  }
}
