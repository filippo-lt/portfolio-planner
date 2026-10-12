import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildSimilar = vi.fn(async () => []);
vi.mock('@/lib/report', () => ({ buildSimilar, SYMBOL_RE: /^[A-Za-z0-9.^=-]{1,20}$/ }));

describe('GET /api/similar dates', () => {
  beforeEach(() => buildSimilar.mockClear());
  const call = async (q: string) => {
    const { GET } = await import('../../app/api/similar/route');
    await GET(new Request(`http://x/api/similar?symbol=ABC&${q}`));
    return (buildSimilar.mock.calls[0] as unknown as [string, { full?: unknown; year?: unknown }])[1];
  };
  it('keeps real calendar dates', async () => {
    expect((await call('from=2024-02-29&to=2025-01-31')).full).toEqual({ from: '2024-02-29', to: '2025-01-31' });
  });
  it('drops dates that match the pattern but do not exist', async () => {
    expect((await call('from=2024-02-31&to=2025-01-31')).full).toBeUndefined();
    expect((await call('yfrom=2024-01-01&yto=2025-13-01')).year).toBeUndefined();
  });
});
