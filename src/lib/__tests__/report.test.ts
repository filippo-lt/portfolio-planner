import { describe, expect, it, vi } from 'vitest';
import { FORBIDDEN } from './profileFit.test';

vi.mock('../cache', () => ({
  cached: (_k: string, _t: number, fn: () => Promise<unknown>) => fn(),
  TTL_PRICES: 0,
  TTL_PROFILE: 0,
}));
vi.mock('../data/yahoo', () => ({
  yahooProvider: {
    resolve: async () => [],
    getProfile: async (s: string) => ({
      symbol: s,
      name: s,
      type: 'STOCK',
      currency: s === 'AAA' ? 'USD' : 'EUR',
      exchange: 'X',
    }),
    getHistory: async () =>
      Array.from({ length: 40 }, (_, i) => ({
        date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
        close: 100 + i,
      })),
  },
}));

describe('buildReport notes', () => {
  it('adds a neutral currency note and no judgmental words', async () => {
    const { buildReport } = await import('../report');
    const r = await buildReport('AAA', 'BBB');
    expect(r.notes.length).toBeGreaterThan(0);
    for (const n of r.notes) expect(n).not.toMatch(FORBIDDEN);
    expect(r.monthly.length).toBeGreaterThan(1);
  });
});

describe('buildReport benchmark choice', () => {
  it('asks for a reference when the class has no default and none was given', async () => {
    const { buildReport, CHOOSE_BENCHMARK } = await import('../report');
    const r = await buildReport('AAA');
    expect(r.benchmark).toEqual({ symbol: '', error: CHOOSE_BENCHMARK });
    expect(r.chart).toEqual([]);
  });
});

describe('classMismatch', () => {
  it('names both classes in Italian when known and different', async () => {
    const { classMismatch } = await import('../report');
    const msg = classMismatch('equity', 'bond');
    expect(msg).toBe('Strumento di tipo diverso (obbligazionario vs azionario): il confronto potrebbe non essere omogeneo.');
    expect(msg).not.toMatch(FORBIDDEN);
  });
  it('stays silent when equal or when either is unknown/missing', async () => {
    const { classMismatch } = await import('../report');
    expect(classMismatch('equity', 'equity')).toBeUndefined();
    expect(classMismatch('equity', 'unknown')).toBeUndefined();
    expect(classMismatch(undefined, 'bond')).toBeUndefined();
    expect(classMismatch('other', undefined)).toBeUndefined();
  });
});
