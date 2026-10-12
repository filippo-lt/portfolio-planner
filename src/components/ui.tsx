'use client';

import Link from 'next/link';
import { useRef, type ComponentProps, type ReactNode, type Ref } from 'react';
import type { Tone } from '@/lib/tone';

export type { Tone };

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type ButtonProps = ComponentProps<'button'> & { variant?: keyof typeof BTN_VARIANT; loading?: boolean; block?: boolean };

const BTN_BASE =
  'pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold disabled:opacity-60 disabled:active:scale-100';
const BTN_VARIANT = {
  primary: 'btn-primary bg-accent text-accent-fg',
  secondary: 'border border-accent/30 bg-surface text-accent hover:border-accent/60 hover:bg-accent-soft',
  ghost: 'text-accent hover:bg-accent-soft',
  danger: 'border border-error-line bg-error-soft text-error hover:border-error',
};

export function Button({ variant = 'primary', loading, block, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(BTN_BASE, BTN_VARIANT[variant], block && 'w-full', className)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'primary', block, className, ...rest }: ComponentProps<typeof Link> & { variant?: keyof typeof BTN_VARIANT; block?: boolean }) {
  return <Link {...rest} className={cx(BTN_BASE, BTN_VARIANT[variant], block && 'w-full', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('h-5 w-5 animate-spin', className)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div {...rest} className={cx('card rounded-2xl border border-line bg-surface p-4 sm:p-5', className)}>
      {children}
    </div>
  );
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'bad' | 'good' }) {
  const t = {
    neutral: 'bg-surface-2 text-ink',
    accent: 'bg-accent-soft text-accent',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-error-soft text-error',
    good: 'bg-success-soft text-success',
  }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>;
}

/* ---------- semantic tones: good / worry / bad ---------- */

export const TONE_TEXT: Record<Tone, string> = { good: 'text-success', worry: 'text-warn', bad: 'text-error', neutral: '' };
export const TONE_SOFT: Record<Tone, string> = {
  good: 'bg-success-soft text-success',
  worry: 'bg-warn-soft text-warn',
  bad: 'bg-error-soft text-error',
  neutral: 'bg-surface-2 text-muted',
};
const TONE_EDGE: Record<Tone, string> = {
  good: 'border-l-success',
  worry: 'border-l-warn',
  bad: 'border-l-error',
  neutral: 'border-l-line',
};
export const toneEdge = (t: Tone) => cx('border-l-4', TONE_EDGE[t]);

/** Sign of a return: gains read green, losses red. */
export const signTone = (v: number | undefined): Tone => (v === undefined || v === 0 ? 'neutral' : v > 0 ? 'good' : 'bad');

export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const c = cx('h-4 w-4 shrink-0', className);
  if (tone === 'good')
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className={c}>
        <circle cx="10" cy="10" r="8.25" fill="currentColor" opacity="0.18" />
        <path d="M6 10.4 8.7 13 14 7.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (tone === 'worry')
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className={c}>
        <path d="M10 2.8 18 16.5H2L10 2.8Z" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M10 8v3.8M10 14.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  if (tone === 'bad')
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className={c}>
        <circle cx="10" cy="10" r="8.25" fill="currentColor" opacity="0.18" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={c}>
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5M10 6.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Status pill with icon: the color is never the only signal, the label always says it. */
export function TonePill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2.5 text-xs font-semibold', TONE_SOFT[tone], className)}>
      <ToneIcon tone={tone} className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

/** Inline emphasis inside running text. */
export function Hl({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <strong className={cx('font-semibold', TONE_TEXT[tone])}>{children}</strong>;
}

export type HlRule = [RegExp, Tone | ((match: string) => Tone)];

/** Highlights the parts of a plain sentence that match the rules (first rule wins on overlap). */
export function ToneText({ text, rules }: { text: string; rules: HlRule[] }) {
  const out: ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest) {
    let best: { i: number; m: string; tone: Tone } | undefined;
    for (const [re, t] of rules) {
      const m = new RegExp(re.source, re.flags.replace('g', '')).exec(rest);
      if (m && m[0] && (!best || m.index < best.i)) best = { i: m.index, m: m[0], tone: typeof t === 'function' ? t(m[0]) : t };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.i > 0) out.push(rest.slice(0, best.i));
    out.push(
      <Hl key={k++} tone={best.tone}>
        {best.m}
      </Hl>,
    );
    rest = rest.slice(best.i + best.m.length);
  }
  return <>{out}</>;
}

/** Signed percentages in free text: losses red, explicit gains green. */
export const SIGNED_PCT_RULES: HlRule[] = [
  [/[-−]\s?\d+(?:[.,]\d+)?\s?%/, 'bad'],
  [/\+\s?\d+(?:[.,]\d+)?\s?%/, 'good'],
];

export function Callout({ tone, children, className, role }: { tone: Tone | 'accent'; children: ReactNode; className?: string; role?: string }) {
  const bg = tone === 'accent' ? 'bg-accent-soft' : tone === 'neutral' ? 'bg-surface-2' : TONE_SOFT[tone].split(' ')[0];
  const ic = tone === 'accent' ? 'text-accent' : TONE_TEXT[tone] || 'text-muted';
  return (
    <div role={role} className={cx('flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm text-ink', bg, className)}>
      <ToneIcon tone={tone === 'accent' ? 'neutral' : tone} className={cx('mt-0.5 h-[1.125rem] w-[1.125rem]', ic)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton', className)} />;
}

/** (i) button opening a plain-language definition: bottom sheet on mobile, dialog on desktop. */
export function InfoTip({ term, children }: { term: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button
        type="button"
        aria-label={`Cos'è: ${term}`}
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        className="pressable -my-2.5 ml-0.5 inline-grid h-11 w-9 place-items-center rounded-full align-middle text-muted hover:text-ink"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-[1.05rem] w-[1.05rem]">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 9v5M10 6.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <Sheet ref={ref} title={term}>
        <p className="mt-2 leading-relaxed text-muted">{children}</p>
        <Button variant="secondary" block className="mt-5" onClick={close}>
          Ho capito
        </Button>
      </Sheet>
    </>
  );
}

/** Modal <dialog>: bottom sheet on mobile, centered dialog on desktop. Backdrop click closes. */
export function Sheet({ ref, title, onClose, children }: { ref: Ref<HTMLDialogElement>; title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="sheet m-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-3xl border-t border-line bg-surface p-0 text-ink shadow-2xl sm:m-auto sm:max-w-md sm:rounded-3xl sm:border"
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'pressable min-h-10 flex-1 rounded-lg px-3 text-sm font-medium',
              on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="pressable -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
        <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}

export function PageLoading() {
  return (
    <div role="status" aria-label="Caricamento" className="space-y-3 pt-2">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
