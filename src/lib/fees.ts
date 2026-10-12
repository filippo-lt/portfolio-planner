/** Isomorphic and pure: entry/exit fee merge and input parsing. */
import type { FeeValue, InstrumentProfile } from './data/types';
import { parseItDecimal } from './profileValidation';

/** Fees typed by the user, as fractions (0.01 = 1%). */
export interface UserFees {
  entry?: number;
  exit?: number;
}

export interface EffectiveFees {
  entry?: FeeValue;
  exit?: FeeValue;
  performance?: FeeValue;
}

export const MAX_FEE_PCT = 10;

const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_FEE_PCT / 100;

/** Keeps only valid fractions from untrusted stored data. */
export function parseUserFees(o: unknown): UserFees {
  const r = (o ?? {}) as Record<string, unknown>;
  const out: UserFees = {};
  if (valid(r.entry)) out.entry = r.entry;
  if (valid(r.exit)) out.exit = r.exit;
  return out;
}

/** Data values win; a user value fills a gap only. Nothing is estimated. */
export function effectiveFees(profile: Pick<InstrumentProfile, 'entryFee' | 'exitFee' | 'performanceFee'>, userFees: UserFees = {}): EffectiveFees {
  const out: EffectiveFees = {};
  const entry = profile.entryFee ?? (valid(userFees.entry) ? { value: userFees.entry, source: 'user' as const } : undefined);
  const exit = profile.exitFee ?? (valid(userFees.exit) ? { value: userFees.exit, source: 'user' as const } : undefined);
  if (entry) out.entry = entry;
  if (exit) out.exit = exit;
  if (profile.performanceFee) out.performance = profile.performanceFee;
  return out;
}

export type FeeInput = { ok: true; value: number | undefined } | { ok: false };

/** Parses a percent typed in Italian ("1,5"): empty clears, 0-10 accepted. Returns a fraction. */
export function parseFeeInput(raw: string): FeeInput {
  if (!raw.trim()) return { ok: true, value: undefined };
  const pct = parseItDecimal(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct > MAX_FEE_PCT) return { ok: false };
  return { ok: true, value: Number((pct / 100).toFixed(6)) };
}

/** Fraction to the text shown in the input ("0,015" -> "1,5"). */
export function feeToInput(v: number | undefined): string {
  return v === undefined ? '' : String(Number((v * 100).toFixed(4))).replace('.', ',');
}

export const FEE_SOURCE_LABEL: Record<FeeValue['source'], string> = {
  kid: 'da KID',
  manual: 'inserito manualmente',
  user: 'inserito da te',
};
