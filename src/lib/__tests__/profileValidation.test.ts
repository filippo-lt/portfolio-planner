import { describe, expect, it } from 'vitest';
import { profileWarnings, validateProfile, type ProfileForm } from '../profileValidation';

const base: ProfileForm = {
  age: '35',
  horizonYears: '10',
  retirementAge: '67',
  netWorthEur: '50000',
  maxDrawdownPct: '20',
  knowledge: 'base',
};

describe('validateProfile', () => {
  it('accepts a valid profile (comma decimals too)', () => {
    const r = validateProfile({ ...base, netWorthEur: '1234,5', maxDrawdownPct: '12.5' });
    expect(r.errors).toEqual({});
    expect(r.profile?.netWorthEur).toBe(1234.5);
    expect(r.profile?.maxDrawdownPct).toBe(12.5);
  });
  it('reads Italian thousands separators', () => {
    expect(validateProfile({ ...base, netWorthEur: '50.000' }).profile?.netWorthEur).toBe(50000);
    expect(validateProfile({ ...base, netWorthEur: '1.234.567,89' }).profile?.netWorthEur).toBe(1234567.89);
    expect(validateProfile({ ...base, netWorthEur: '€ 50.000' }).profile?.netWorthEur).toBe(50000);
    expect(validateProfile({ ...base, maxDrawdownPct: '20%' }).profile?.maxDrawdownPct).toBe(20);
    expect(validateProfile({ ...base, netWorthEur: '50.00.0' }).errors.netWorthEur).toBeDefined();
  });
  it('rejects exponent and other non-strict numbers', () => {
    expect(validateProfile({ ...base, netWorthEur: '1e3' }).errors.netWorthEur).toBeDefined();
    expect(validateProfile({ ...base, age: '3e1' }).errors.age).toBeDefined();
    expect(validateProfile({ ...base, maxDrawdownPct: '0x14' }).errors.maxDrawdownPct).toBeDefined();
    expect(validateProfile({ ...base, netWorthEur: '-5' }).errors.netWorthEur).toBeDefined();
    expect(validateProfile({ ...base, age: '' }).errors.age).toBeDefined();
  });
  it('limits horizon to 80 years', () => {
    expect(validateProfile({ ...base, horizonYears: '80' }).errors.horizonYears).toBeUndefined();
    expect(validateProfile({ ...base, horizonYears: '81' }).errors.horizonYears).toBeDefined();
  });
});

describe('profileWarnings', () => {
  it('warns (without blocking) when horizon exceeds years to retirement', () => {
    const f = { ...base, horizonYears: '40' };
    expect(profileWarnings(f)).toHaveLength(1);
    expect(profileWarnings(f)[0]).toContain('32');
    expect(validateProfile(f).profile).toBeDefined();
  });
  it('is silent otherwise', () => {
    expect(profileWarnings(base)).toEqual([]);
    expect(profileWarnings({ ...base, retirementAge: '35', horizonYears: '40' })).toEqual([]);
  });
});

describe('validateProfile taxCountry', () => {
  const form = {
    age: '40',
    horizonYears: '10',
    retirementAge: '67',
    netWorthEur: '50000',
    maxDrawdownPct: '20',
    knowledge: 'base' as const,
  };
  it('is optional', () => {
    expect(validateProfile(form).profile?.taxCountry).toBeUndefined();
    expect(validateProfile({ ...form, taxCountry: '' }).profile?.taxCountry).toBeUndefined();
  });
  it('accepts a listed country and rejects others', () => {
    expect(validateProfile({ ...form, taxCountry: 'UK' }).profile?.taxCountry).toBe('UK');
    expect(validateProfile({ ...form, taxCountry: 'XX' as never }).errors.taxCountry).toBeDefined();
  });
});
