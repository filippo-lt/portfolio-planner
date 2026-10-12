/** Isomorphic: accumulating vs distributing share class. Curated list first, then name hints, else unknown. */
import { findBenchmark } from './benchmarks';

export type Distribution = 'acc' | 'dist';

export const ACC_LABEL = 'Ad accumulazione';
export const DIST_LABEL = 'A distribuzione';
export const DIST_UNKNOWN = 'Politica dei proventi: Dato non disponibile';
export const DIVIDENDS_UNKNOWN = 'Cedole/dividendi: Dato non disponibile';

const DIST_RE = /\bdist\b|\b1d\b|distributing|distribuzione|\binc\b/i;
const ACC_RE = /\bacc\b|\b1c\b|accumulating|accumulazione|capitalizzazione/i;

/** Curated entry wins; otherwise the name (never for stocks: "Inc" there is a company suffix). Conflicting hints mean unknown. */
export function detectDistribution(symbol: string, name: string, type?: string): Distribution | undefined {
  const curated = findBenchmark(symbol)?.distribution;
  if (curated) return curated;
  if (type === 'STOCK') return undefined;
  const dist = DIST_RE.test(name);
  const acc = ACC_RE.test(name);
  if (dist === acc) return undefined;
  return dist ? 'dist' : 'acc';
}
