import { describe, expect, it } from 'vitest';
import { validateSummary } from '../summaryValidation';

const input = {
  instrument: { fundamentals: { revenue: 416161000000, fiscalYear: 2025 } },
  metrics: {
    return5y: 0.12231,
    volatility: 0.1298,
    return1y: 0.0812,
    return3y: 0.0862,
    maxDrawdown: { value: -0.3343, peakDate: '2020-02-19', troughDate: '2020-03-23' },
  },
  fit: ['Il drawdown massimo storico (-33%) supera la tolleranza indicata (-20%) di 13 punti.'],
};
const ok = (s: string) => validateSummary(s, input).ok;

describe('validateSummary', () => {
  it('accepts it-IT and en percentages derived from fractions', () => {
    expect(ok('Il rendimento a 5 anni è 12,2% e la volatilità 13,0%.')).toBe(true);
    expect(ok('Volatility 13.0%.')).toBe(true);
  });
  it('accepts full-digit large amounts, rejects scaled ones', () => {
    expect(ok('I ricavi sono 416.161.000.000 USD.')).toBe(true);
    expect(ok('I ricavi sono 416,2 miliardi.')).toBe(false);
  });
  it('rejects invented numbers', () => {
    expect(ok('Il rendimento è 25,4%.')).toBe(false);
  });
  it('requires matching sign: plus never matches a negative source', () => {
    expect(ok('Il drawdown è -33,4%.')).toBe(true);
    expect(ok('Il drawdown è +33,4%.')).toBe(false);
  });
  it('accepts an unsigned value for a negative source', () => {
    expect(ok('Il drawdown massimo è 33,4%.')).toBe(true);
  });
  it('rejects a minus sign on a positive source', () => {
    expect(ok('Il rendimento è -12,2%.')).toBe(false);
  });
  it('rounds the source, with no extra tolerance', () => {
    const low = { metrics: { return1y: 0.0812 } };
    const high = { metrics: { return1y: 0.0862 } };
    expect(validateSummary('Il rendimento a 1 anno è 8%.', low).ok).toBe(true); // 8.12 -> 8
    expect(validateSummary('Il rendimento a 1 anno è 8%.', high).ok).toBe(false); // 8.62 -> 9
    expect(validateSummary('Il rendimento a 1 anno è 9%.', high).ok).toBe(true);
    expect(validateSummary('Il rendimento a 1 anno è 8,6%.', high).ok).toBe(true);
    expect(validateSummary('Il rendimento a 1 anno è 8,5%.', high).ok).toBe(false);
  });
  it('treats ISO dates and years as whole tokens', () => {
    expect(ok('Il massimo precedente è del 2020-02-19.')).toBe(true);
    expect(ok('Il massimo precedente è del 2020-02-20.')).toBe(false);
    expect(ok('Il minimo è stato il 23 marzo 2020.')).toBe(true);
    expect(ok('Il minimo è stato il 24 marzo 2020.')).toBe(false);
    expect(ok("I dati si riferiscono all'esercizio 2025.")).toBe(true);
    expect(ok("I dati si riferiscono all'esercizio 2019.")).toBe(false);
  });
  it('rejects Italian number words', () => {
    expect(ok('La volatilità è di tredici punti.')).toBe(false);
    expect(ok('Il rendimento è cinque per cento.')).toBe(false);
  });
  it.each([
    'migliore',
    'meglio',
    'ideale',
    'acquistare',
    'dovresti',
    'scegli',
    'peggiore',
    'evita',
    'opportunità',
    'dovrebbe',
    'buono',
  ])('rejects forbidden stem %s', (w) => {
    expect(ok(`Un dato ${w}: 12,2%.`)).toBe(false);
  });
});
