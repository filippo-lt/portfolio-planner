import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: () => {} }));
import { shareEuro } from '../shareProfile';

describe('shareEuro', () => {
  it('passes a final "no line" result through', async () => {
    expect(await shareEuro('ABC', 50, async () => ({ final: true }))).toEqual({ final: true });
  });
  it('is not final when the build outlasts the timeout', async () => {
    const slow = () => new Promise<never>(() => {});
    expect(await shareEuro('ABC', 10, slow)).toEqual({ final: false });
  });
  it('returns the line when built in time', async () => {
    expect(await shareEuro('ABC', 50, async () => ({ line: 'x', final: true }))).toEqual({ line: 'x', final: true });
  });
});
