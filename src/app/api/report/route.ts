import { NextResponse } from 'next/server';
import { buildReport, DEFAULT_BENCHMARK } from '@/lib/report';

const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const symbol = sp.get('symbol')?.trim();
  const benchmark = sp.get('benchmark')?.trim() || DEFAULT_BENCHMARK;
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: 'Simbolo non valido' }, { status: 400 });
  }
  if (!SYMBOL_RE.test(benchmark)) {
    return NextResponse.json({ error: 'Benchmark non valido' }, { status: 400 });
  }
  try {
    return NextResponse.json(await buildReport(symbol, benchmark));
  } catch {
    return NextResponse.json({ error: 'Strumento non trovato o dati non disponibili' }, { status: 502 });
  }
}
