import { describe, expect, it } from 'vitest';
import { isValidIsin } from '../isin';

describe('isValidIsin', () => {
  it('accepts known-good ISINs', () => {
    for (const i of ['US0378331005', 'US5949181045', 'GB0002634946', 'DE000BAY0017', 'IE00B4L5Y983']) {
      expect(isValidIsin(i)).toBe(true);
    }
  });
  it('rejects wrong check digit and bad shapes', () => {
    for (const i of ['US0378331006', 'IE00B4L5Y984', 'US037833100', '', 'us0378331005', '1234567890AB']) {
      expect(isValidIsin(i)).toBe(false);
    }
  });
});
