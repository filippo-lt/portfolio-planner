import type { AssetClass, InstrumentType } from './data/types';

export interface AssetClassInput {
  type: InstrumentType;
  name: string;
  category?: string;
  /** Fractions 0..1 */
  stockPosition?: number;
  bondPosition?: number;
  cashPosition?: number;
}

export interface AssetClassResult {
  assetClass: AssetClass;
  reason: string;
}

const BOND_WORDS = [
  'bond',
  'obblig',
  'aggregate',
  'treasury',
  'govt',
  'government',
  'corporate',
  'fixed income',
  'reddito fisso',
  'monetari',
  'money market',
];
const MIXED_WORDS = ['allocation', 'bilanciat', 'multi-asset', 'flessibil', 'mixed', 'lifestrategy'];
const EQUITY_WORDS = ['equity', 'azionar', 'stock', 'msci', 's&p', 'ftse all-world'];
const OTHER_WORDS = ['commodity', 'commodities', 'materie prime', 'gold', 'oro'];
// Short words like "gold" or "oro" must match whole words (not "Goldman" or "Euro").
const OTHER_RE = new RegExp(`\\b(${OTHER_WORDS.join('|')})\\b`);

const hasWord = (text: string, words: string[]) => words.some((w) => text.includes(w));

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Decides what an instrument mainly invests in. Rules run in order and anything that
 * does not match stays "unknown": it is never assumed to be equity.
 */
export function classifyAssetClass(input: AssetClassInput): AssetClassResult {
  if (input.type === 'STOCK') return { assetClass: 'equity', reason: 'Azione singola' };

  const { stockPosition: stock, bondPosition: bond } = input;
  if (stock !== undefined && stock >= 0.7) {
    return { assetClass: 'equity', reason: `Azioni al ${pct(stock)} del portafoglio` };
  }
  if (bond !== undefined && bond >= 0.7) {
    return { assetClass: 'bond', reason: `Obbligazioni al ${pct(bond)} del portafoglio` };
  }
  if (stock !== undefined && bond !== undefined && stock + bond >= 0.7 && stock >= 0.15 && bond >= 0.15) {
    return {
      assetClass: 'mixed',
      reason: `Azioni ${pct(stock)} e obbligazioni ${pct(bond)} del portafoglio`,
    };
  }

  const category = input.category?.trim();
  const sources: { text: string; reason: string }[] = [];
  if (category) sources.push({ text: category, reason: `Categoria Yahoo: ${category}` });
  if (input.name) sources.push({ text: input.name, reason: `Dal nome dello strumento: ${input.name}` });

  for (const { text, reason } of sources) {
    const t = text.toLowerCase();
    if (hasWord(t, BOND_WORDS)) return { assetClass: 'bond', reason };
    if (hasWord(t, MIXED_WORDS)) return { assetClass: 'mixed', reason };
    if (hasWord(t, EQUITY_WORDS)) return { assetClass: 'equity', reason };
    if (OTHER_RE.test(t)) return { assetClass: 'other', reason };
  }

  return { assetClass: 'unknown', reason: 'Dati insufficienti per stabilire il tipo' };
}
