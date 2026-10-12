/** Pure helpers to check that an AI summary only uses numbers present in its input. */
import { findBannedWords } from './tone';

/** Extra words rejected only in AI output (UI instructions such as "Scegli un riferimento" are fine). */
const SUMMARY_ONLY_BANNED =
  /(?<![\p{L}\p{N}_])(?:scegli\p{L}*|evita\p{L}*|opportun\p{L}*|previsione|previsioni|prevedi\p{L}*)(?![\p{L}\p{N}_])/iu;

/** Italian number words (ambiguous ones such as "uno/una/sei" are left out). The model is told to use digits only. */
export const NUMBER_WORDS =
  /\b(due|tre|quattro|cinque|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta|cento|mille|duemila|milione|milioni|miliardo|miliardi|trilione|trilioni|zero)\b/i;

const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;
const MONTHS = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];
const IT_DATE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})\\b`, 'gi');
const SLASH_DATE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const NUM_TOKEN = /(?<![\w.,])([+\-−–]?)(\d[\d.,]*)/g;

const pad = (n: string | number) => String(n).padStart(2, '0');

export interface ParsedToken {
  /** Possible unsigned readings (it-IT / en) */
  values: number[];
  /** Decimals implied by each reading */
  decimals: number[];
}

/** Possible unsigned numeric readings of a token (it-IT "1.234,5" and en "1,234.5"). */
export function parseNumberToken(tok: string): ParsedToken {
  const t = tok.replace(/[.,]+$/, '');
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decSep = Math.max(lastDot, lastComma);
    const clean = t.slice(0, decSep).replace(/[.,]/g, '') + '.' + t.slice(decSep + 1);
    return { values: [parseFloat(clean)], decimals: [t.length - decSep - 1] };
  }
  const sep = lastDot >= 0 ? lastDot : lastComma;
  if (sep < 0) return { values: [parseFloat(t)], decimals: [0] };
  const count = (t.match(/[.,]/g) ?? []).length;
  const after = t.length - sep - 1;
  const asThousands = parseFloat(t.replace(/[.,]/g, ''));
  const asDecimal = parseFloat(t.slice(0, sep).replace(/[.,]/g, '') + '.' + t.slice(sep + 1));
  if (count > 1) return { values: [asThousands], decimals: [0] };
  if (after === 3) return { values: [asThousands, asDecimal], decimals: [0, 3] };
  return { values: [asDecimal], decimals: [after] };
}

export interface SourceNumbers {
  /** Candidate source values, signed */
  numbers: number[];
  /** ISO dates found in the input */
  dates: Set<string>;
  /** Years found in input dates or as 4-digit values */
  years: Set<number>;
}

/** Collects numbers, ISO dates and years from a JSON-like input. Dates are never split into digit parts. */
export function collectSource(
  value: unknown,
  out: SourceNumbers = { numbers: [], dates: new Set(), years: new Set() },
): SourceNumbers {
  const addStr = (s: string) => {
    for (const d of s.match(ISO_DATE) ?? []) {
      out.dates.add(d);
      out.years.add(Number(d.slice(0, 4)));
    }
    const rest = s.replace(ISO_DATE, ' ');
    for (const m of rest.matchAll(NUM_TOKEN)) {
      const neg = m[1] === '-' || m[1] === '−' || m[1] === '–';
      for (const v of parseNumberToken(m[2]).values) out.numbers.push(neg ? -v : v);
    }
  };
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.numbers.push(value);
    if (Number.isInteger(value) && value >= 1900 && value <= 2100) out.years.add(value);
  } else if (typeof value === 'string') {
    addStr(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectSource(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      for (const d of k.match(/\d+/g) ?? []) out.numbers.push(Number(d)); // keys such as return1y / return5y carry the period
      collectSource(v, out);
    }
  }
  return out;
}

/** Source rounded half-up (on the magnitude) to `d` decimals, as an integer count of 10^-d units. */
const scaled = (x: number, d: number) => Math.round(Math.abs(x) * 10 ** d + 1e-9);

/**
 * The output must equal the source (raw, or x100 for fractions) rounded to the
 * decimals written in the output. An explicit "+" needs a positive source, an
 * explicit "-" a negative one; an unsigned token is accepted for either sign.
 */
function numberMatches(sign: string, x: number, decimals: number, numbers: number[]): boolean {
  const target = Math.round(Math.abs(x) * 10 ** decimals);
  for (const a of numbers) {
    for (const f of [a, a * 100]) {
      if (scaled(f, decimals) !== target) continue;
      if (sign === '+' && f <= 0) continue;
      if (sign === '-' && f >= 0) continue;
      return true;
    }
  }
  return false;
}

/** Returns offending tokens (empty = valid). */
export function findUnknownNumbers(output: string, input: unknown): string[] {
  const src = collectSource(input);
  const bad: string[] = [];

  // Full dates must exist in the input as ISO dates; they are never split.
  const checkDate = (iso: string, raw: string) => {
    if (!src.dates.has(iso)) bad.push(raw);
    return ' ';
  };
  let text = output.replace(ISO_DATE, (m) => checkDate(m, m));
  text = text.replace(IT_DATE, (m, d, mon, y) =>
    checkDate(`${y}-${pad(MONTHS.indexOf(String(mon).toLowerCase()) + 1)}-${pad(d)}`, m),
  );
  text = text.replace(SLASH_DATE, (m, d, mo, y) => checkDate(`${y}-${pad(mo)}-${pad(d)}`, m));

  for (const m of text.matchAll(NUM_TOKEN)) {
    const sign = m[1] === '+' ? '+' : m[1] ? '-' : '';
    const tok = m[2];
    if (sign === '' && /^(19|20)\d{2}$/.test(tok) && src.years.has(Number(tok))) continue; // whole-token year
    const parsed = parseNumberToken(tok);
    const ok = parsed.values.some(
      (v, i) => Number.isFinite(v) && numberMatches(sign, v, parsed.decimals[i], src.numbers),
    );
    if (!ok) bad.push(m[0]);
  }
  return bad;
}

export function validateSummary(output: string, input: unknown): { ok: boolean; reason?: string } {
  if (!output.trim()) return { ok: false, reason: 'vuoto' };
  if (findBannedWords(output).length || SUMMARY_ONLY_BANNED.test(output))
    return { ok: false, reason: 'parole non ammesse' };
  if (NUMBER_WORDS.test(output)) return { ok: false, reason: 'numeri scritti a parole' };
  const bad = findUnknownNumbers(output, input);
  if (bad.length) return { ok: false, reason: `numeri non presenti nei dati: ${bad.join(', ')}` };
  return { ok: true };
}
