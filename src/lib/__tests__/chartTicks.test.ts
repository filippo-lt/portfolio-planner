import { describe, expect, it } from 'vitest';
import { chartTicks } from '../chartTicks';
import { fmtMonthYear } from '../format';

function daily(years: number, end = '2025-06-30'): string[] {
  const endMs = Date.parse(end + 'T00:00:00Z');
  const n = Math.round(years * 365.25);
  return Array.from({ length: n + 1 }, (_, i) => new Date(endMs - (n - i) * 86400000).toISOString().slice(0, 10));
}

describe('chartTicks', () => {
  it('returns no ticks for empty data', () => {
    expect(chartTicks([]).ticks).toEqual([]);
  });

  it.each([1, 3, 5, 10])('has no equal neighbouring labels on a %sy span', (y) => {
    const { ticks, unit } = chartTicks(daily(y));
    const labels = ticks.map((d) => (unit === 'year' ? d.slice(0, 4) : fmtMonthYear(d)));
    expect(labels.length).toBeGreaterThan(1);
    labels.forEach((l, i) => i > 0 && expect(l).not.toBe(labels[i - 1]));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('uses one tick per year over 3 years, on the first date of that year', () => {
    const { ticks, unit } = chartTicks(daily(5, '2025-06-30'));
    expect(unit).toBe('year');
    expect(ticks[1]).toBe('2021-01-01');
  });

  it('uses month labels up to 3 years and caps the count', () => {
    const { ticks, unit } = chartTicks(daily(2.9));
    expect(unit).toBe('month');
    expect(ticks.length).toBeLessThanOrEqual(8);
  });

  it('ticks are dates present in the input', () => {
    const d = daily(1);
    chartTicks(d).ticks.forEach((t) => expect(d).toContain(t));
  });
});

describe('fmtMonthYear', () => {
  it('formats in Italian short form', () => {
    expect(fmtMonthYear('2023-01-15')).toBe('gen 23');
    expect(fmtMonthYear('2024-12-01')).toBe('dic 24');
  });
});
