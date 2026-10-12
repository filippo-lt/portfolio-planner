/** Isomorphic and pure: cost figures in euros. */

/** Fixed example amount until the user amount is wired in. */
export const EXAMPLE_AMOUNT = 1000;

/** Whole euros the TER costs per year on `amount`; undefined when the TER or amount is missing. */
export function terCostPerYear(amount: number, ter: number | undefined): number | undefined {
  if (ter === undefined || !Number.isFinite(ter) || !Number.isFinite(amount)) return undefined;
  return Math.round(amount * ter);
}
