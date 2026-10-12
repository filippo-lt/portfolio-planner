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
