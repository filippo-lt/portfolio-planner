import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { cacheGet, cacheSet, TTL_PROFILE } from '@/lib/cache';
import { validateSummary } from '@/lib/summaryValidation';

const LEVELS = ['base', 'intermedio', 'avanzato'] as const;
const MAX_BODY = 100_000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(req: Request): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.delete(ip);
  hits.set(ip, recent);
  while (hits.size > 1000) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
  return recent.length > RATE_LIMIT;
}
const DEFAULT_MODEL = 'claude-haiku-5-5';

const SYSTEM = `Sei un assistente che riassume dati finanziari in italiano.
Scrivi da 3 a 5 frasi neutre che descrivono SOLO i numeri presenti nel JSON fornito.
Regole:
- Usa esclusivamente numeri presenti nel JSON (percentuali già indicate o ricavabili moltiplicando per 100 una frazione). Nessun nuovo calcolo, nessuna stima, nessun arrotondamento diverso da quello dei dati.
- Nessuna opinione, nessun consiglio, nessuna previsione, nessuna raccomandazione. Nessun giudizio di valore (evita aggettivi come buono, cattivo, ottimo, adatto, sicuro, rischioso).
- Non suggerire mai di comprare, vendere o tenere un prodotto e non indicare un prodotto come preferibile a un altro. Non usare parole di classifica o di giudizio (migliore, peggiore, conviene, consigliato, raccomandato, compra, acquista, dovresti).
- Se un dato manca, scrivi "Dato non disponibile" invece di ipotizzarlo.
- Per i confronti con il profilo dell'investitore riporta i fatti nella forma presente in "fit".
- Adatta il livello di dettaglio: "base" = pochi numeri chiave; "intermedio" = più numeri; "avanzato" = tutti i numeri rilevanti.
- Scrivi tutti i numeri in cifre, mai a parole. Riporta gli importi grandi come numero intero completo con separatori delle migliaia (es. 416.161.000.000), senza abbreviazioni come "miliardi".
- Usa il segno (+ o -) solo se il numero lo ha nel JSON o nel testo di "fit"; non aggiungere un + a numeri negativi.
- Riporta le date nel formato presente nel JSON (AAAA-MM-GG).
- Solo testo semplice, senza elenchi né markdown.`;

/* eslint-disable @typescript-eslint/no-explicit-any */
const pickNum = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const pickStr = (v: any, max = 120) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const pickList = (v: any, n = 10) =>
  Array.isArray(v)
    ? v.slice(0, n).map((x: any) => ({ name: pickStr(x?.name), weight: pickNum(x?.weight) }))
    : undefined;

function slimMetrics(m: any) {
  return {
    return1y: pickNum(m?.return1y),
    return3y: pickNum(m?.return3y),
    return5y: pickNum(m?.return5y),
    volatility: pickNum(m?.volatility),
    volatilityYears: pickNum(m?.volatilityYears),
    maxDrawdown: m?.maxDrawdown
      ? {
          value: pickNum(m.maxDrawdown.value),
          peakDate: pickStr(m.maxDrawdown.peakDate, 10),
          troughDate: pickStr(m.maxDrawdown.troughDate, 10),
        }
      : undefined,
    historyStart: pickStr(m?.historyStart, 10),
    historyEnd: pickStr(m?.historyEnd, 10),
  };
}

function slimReport(report: any) {
  const i = report?.instrument ?? {};
  const f = i.fundamentals;
  const b = report?.benchmark;
  return {
    instrument: {
      symbol: pickStr(i.symbol, 20),
      name: pickStr(i.name),
      type: i.type === 'ETF' || i.type === 'FUND' ? i.type : 'STOCK',
      currency: pickStr(i.currency, 6),
      exchange: pickStr(i.exchange, 40),
      isin: pickStr(i.isin, 12),
      ter: pickNum(i.ter),
      holdings: Array.isArray(i.holdings)
        ? i.holdings.slice(0, 10).map((h: any) => ({ name: pickStr(h?.name), weight: pickNum(h?.weight) }))
        : undefined,
      sectors: pickList(i.sectors),
      countries: pickList(i.countries),
      sector: pickStr(i.sector),
      country: pickStr(i.country),
      fundamentals: f
        ? {
            revenue: pickNum(f.revenue),
            netIncome: pickNum(f.netIncome),
            totalDebt: pickNum(f.totalDebt),
            freeCashFlow: pickNum(f.freeCashFlow),
            fiscalYear: pickNum(f.fiscalYear),
            currency: pickStr(f.currency, 6),
          }
        : undefined,
    },
    metrics: slimMetrics(report?.metrics),
    benchmark: b?.profile
      ? { symbol: pickStr(b.profile.symbol, 20), name: pickStr(b.profile.name), metrics: slimMetrics(b.metrics) }
      : undefined,
    notes: Array.isArray(report?.notes) ? report.notes.slice(0, 5).map((n: any) => pickStr(n, 300)) : undefined,
  };
}

async function generate(client: Anthropic, model: string, payload: string): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: 'user', content: payload }],
  });
  return res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ summary: null, reason: 'non configurato' });

  if (rateLimited(req)) return NextResponse.json({ error: 'Troppe richieste, riprova tra poco' }, { status: 429 });
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    return NextResponse.json({ error: 'Richiesta troppo grande' }, { status: 413 });
  }

  let body: any;
  try {
    const text = await req.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY)
      return NextResponse.json({ error: 'Richiesta troppo grande' }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !body.report?.instrument || !LEVELS.includes(body.level)) {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }

  const input = {
    livello: body.level,
    report: slimReport(body.report),
    fit: Array.isArray(body.fit) ? body.fit.map((f: any) => String(f?.text ?? f).slice(0, 500)).slice(0, 10) : [],
  };
  const payload = JSON.stringify(input);
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const key = `summary:${createHash('sha1')
    .update(model + payload)
    .digest('hex')}`;

  const hit = await cacheGet<string>(key);
  if (hit) return NextResponse.json({ summary: hit });

  const client = new Anthropic({ apiKey, timeout: 20_000 });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await generate(client, model, payload);
      if (validateSummary(out, input).ok) {
        await cacheSet(key, out, TTL_PROFILE);
        return NextResponse.json({ summary: out });
      }
    } catch {
      break;
    }
  }
  return NextResponse.json({ summary: null, reason: 'non disponibile' });
}
