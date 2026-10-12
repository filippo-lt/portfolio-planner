import { cacheLife } from 'next/cache';
import type { InstrumentProfile } from './data/types';
import { getInstrumentProfile, SYMBOL_RE } from './report';

/** Same for every visitor, so link previews can share it. Throws (uncached) when the provider fails. */
async function cachedProfile(symbol: string): Promise<InstrumentProfile> {
  'use cache';
  cacheLife('days');
  return getInstrumentProfile(symbol);
}

/** Profile for share metadata; gives up quickly so link previews never hang on the data provider. */
export async function shareProfile(symbol: string, timeoutMs = 2500): Promise<InstrumentProfile | undefined> {
  if (!SYMBOL_RE.test(symbol)) return undefined;
  let giveUp = () => {};
  const timeout = new Promise<undefined>((resolve) => (giveUp = () => resolve(undefined)));
  const timer = setTimeout(giveUp, timeoutMs);
  try {
    return await Promise.race([cachedProfile(symbol).catch(() => undefined), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Route params arrive percent-encoded: decode exactly once. */
export function decodeSymbol(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
