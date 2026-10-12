/** Isomorphic and pure: maps report numbers to a reading tone (good / worry / bad) for the UI. */
import type { FitStatement, InvestorProfile } from './profileFit';
import { horizonBand } from './profileFit';
import { rollingReturnRange } from './metrics';
import type { PricePoint } from './data/types';

/**
 * Words the product must never use (SPEC hard rules): verdicts, rankings, advice, buy/sell calls.
 * Matched case-insensitively on whole words (Unicode-aware), with Italian inflections spelled out,
 * so neutral near-misses such as "compreso" or "comprende" are not flagged.
 */
const W = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${body})(?![\\p{L}\\p{N}_])`, 'iu');
export const BANNED_WORDS: readonly RegExp[] = [
  W('miglior[ei]|meglio'),
  W('peggior[ei]'),
  W('conviene|convengono|convenire|convenient\\p{L}*|convenienza'),
  W('consigliat\\p{L}*|consigli\\p{L}*|sconsigli\\p{L}*'),
  W('compr(a|are|ate|ano|iamo|ando|at[oaie]|i)|comprer\\p{L}*|acquist(a|are|ate|ano|iamo|ando|at[oaie])|acquister\\p{L}*'),
  W('dovrebb\\p{L}*|dovrei|dovrest\\p{L}*'),
  W('raccomand\\p{L}*'),
  W('ottim\\p{L}*|ideale|ideali'),
  W('rischios\\p{L}*|sicur\\p{L}*|prudent\\p{L}*|favorev\\p{L}*'),
  W('adatt\\p{L}*|buon\\p{L}*|cattiv\\p{L}*'),
  W('vend\\p{L}*'),
];

/** Banned words found in `text` (empty = clean). */
export function findBannedWords(text: string): string[] {
  const out: string[] = [];
  for (const re of BANNED_WORDS) {
    const m = text.match(new RegExp(re.source, 'giu'));
    if (m) out.push(...m);
  }
  return out;
}

export type Tone = 'good' | 'worry' | 'bad' | 'neutral';

/** Within this many points of the drawdown threshold counts as "close to it". */
const DD_NEAR_POINTS = 3;
/** Annual volatility that starts to feel large for each horizon band. */
const VOL_LIMIT = { breve: 0.08, medio: 0.18, lungo: 0.25 } as const;

export function drawdownTone(dd: number | undefined, tolerancePct: number): Tone {
  if (dd === undefined) return 'neutral';
  const gap = Math.abs(tolerancePct) - Math.abs(dd * 100);
  if (gap < 0) return 'bad';
  return gap <= DD_NEAR_POINTS ? 'worry' : 'good';
}

export function volatilityTone(vol: number | undefined, horizonYears: number): Tone {
  if (vol === undefined) return 'neutral';
  const lim = VOL_LIMIT[horizonBand(horizonYears)];
  if (vol > lim * 1.6) return 'bad';
  return vol > lim ? 'worry' : 'good';
}

export function terTone(ter: number | undefined): Tone {
  if (ter === undefined) return 'neutral';
  if (ter <= 0.003) return 'good';
  if (ter > 0.01) return 'bad';
  return ter > 0.006 ? 'worry' : 'neutral';
}

export interface FitReading {
  tone: Tone;
  label?: string;
}

const LABELS: Record<FitStatement['id'], Partial<Record<Tone, string>>> = {
  drawdown: { good: 'Entro la tua soglia', worry: 'Vicino alla tua soglia', bad: 'Oltre la tua soglia' },
  volatility: { good: 'Oscillazioni contenute per il tuo orizzonte', worry: 'Oscillazioni ampie per il tuo orizzonte', bad: 'Oscillazioni molto ampie per il tuo orizzonte' },
  rolling: { good: 'Mai in perdita sul tuo orizzonte', worry: 'Anche periodi in perdita', bad: 'Spesso in perdita sul tuo orizzonte' },
  currency: { good: 'Quotato in euro', worry: 'Rischio di cambio' },
};

export function fitReading(
  f: FitStatement,
  profile: InvestorProfile,
  m: { maxDrawdown?: number; volatility?: number; currency: string; monthly?: PricePoint[] },
): FitReading {
  let tone: Tone = 'neutral';
  if (f.id === 'drawdown') tone = drawdownTone(m.maxDrawdown, profile.maxDrawdownPct);
  else if (f.id === 'volatility') tone = volatilityTone(m.volatility, profile.horizonYears);
  else if (f.id === 'rolling') {
    const r = m.monthly ? rollingReturnRange(m.monthly, profile.horizonYears) : undefined;
    // "Bad" when even the middle of the range is a loss.
    if (r) tone = r.worst >= 0 ? 'good' : (r.worst + r.best) / 2 < 0 ? 'bad' : 'worry';
  } else if (f.id === 'currency' && m.currency) tone = m.currency.toUpperCase() === 'EUR' ? 'good' : 'worry';
  return { tone, label: LABELS[f.id][tone] };
}
