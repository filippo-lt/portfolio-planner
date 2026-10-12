import { NextResponse } from 'next/server';
import { searchInstruments } from '@/lib/report';

const Q_RE = /^[\w .&-]+$/;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'Inserisci un ISIN o un ticker' }, { status: 400 });
  if (q.length > 40 || !Q_RE.test(q)) {
    return NextResponse.json(
      { error: 'Ricerca non valida: massimo 40 caratteri, solo lettere, numeri e . & -' },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ results: await searchInstruments(q) });
  } catch {
    return NextResponse.json({ error: 'Strumento non trovato o dati non disponibili' }, { status: 502 });
  }
}
