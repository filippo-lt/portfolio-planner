import { describe, expect, it } from 'vitest';
import { summaryReport } from '../summaryPayload';
import type { Report } from '../report';

describe('summaryReport', () => {
  it('drops the large series and keeps the rest', () => {
    const big = Array.from({ length: 5000 }, (_, i) => ({ date: '2020-01-01', a: i, b: i }));
    const report = {
      instrument: { symbol: 'AAPL' },
      benchmark: { symbol: 'X', error: 'e' },
      metrics: { return1y: 0.1 },
      chart: big,
      monthly: big,
      dist: { instrument: { raw: big, dividends: [] } },
      fx: { instrument: big },
      notes: ['n'],
      generatedAt: 'now',
    } as unknown as Report;
    const slim = summaryReport(report);
    expect(Object.keys(slim).sort()).toEqual(['benchmark', 'generatedAt', 'instrument', 'metrics', 'notes']);
    expect(JSON.stringify(slim).length).toBeLessThan(2000);
  });
});
