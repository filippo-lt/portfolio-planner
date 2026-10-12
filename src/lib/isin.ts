export const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

/** ISIN format plus check digit (letters expand to 10..35, then Luhn over the digit string). */
export function isValidIsin(isin: string): boolean {
  if (!ISIN_RE.test(isin)) return false;
  const digits = [...isin].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('');
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
