import { describe, expect, it } from 'vitest';
import { terCostPerYear } from '../costs';
import { fmtEur } from '../format';
import { terTone } from '../tone';

describe('terCostPerYear', () => {
  it('rounds amount x TER to whole euros', () => {
    expect(terCostPerYear(1000, 0.0019)).toBe(2);
    expect(terCostPerYear(1000, 0.02)).toBe(20);
    expect(terCostPerYear(1000, 0.0007)).toBe(1);
    expect(terCostPerYear(1000, 0.0004)).toBe(0);
  });
  it('is undefined when TER is missing', () => {
    expect(terCostPerYear(1000, undefined)).toBeUndefined();
    expect(terCostPerYear(1000, NaN)).toBeUndefined();
  });
});

describe('fmtEur', () => {
  it('formats whole euros in it-IT', () => {
    expect(fmtEur(1000).replace(/\s/g, ' ')).toBe('1.000 €');
    expect(fmtEur(20)).toBe('20 €');
    expect(fmtEur(undefined)).toBe('Dato non disponibile');
  });
});

describe('terTone', () => {
  it('reads funds with TER 1.5%-3% as the high tone', () => {
    for (const t of [0.015, 0.02, 0.03]) expect(terTone(t)).toBe('bad');
  });
  it('keeps lower bands', () => {
    expect(terTone(0.002)).toBe('good');
    expect(terTone(0.0045)).toBe('neutral');
    expect(terTone(0.008)).toBe('worry');
    expect(terTone(undefined)).toBe('neutral');
  });
});
