'use client';

import Link from 'next/link';
import { useRef, type ComponentProps, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type ButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean; block?: boolean };

const BTN_BASE =
  'pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold disabled:opacity-60 disabled:active:scale-100';
const BTN_VARIANT = {
  primary: 'bg-accent text-accent-fg shadow-[0_1px_2px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:border-line-strong',
  ghost: 'text-accent hover:bg-accent-soft',
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

export function ButtonLink({ variant = 'primary', block, className, ...rest }: ComponentProps<typeof Link> & { variant?: 'primary' | 'secondary' | 'ghost'; block?: boolean }) {
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

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' }) {
  const t = { neutral: 'bg-surface-2 text-ink', accent: 'bg-accent-soft text-accent', warn: 'bg-warn-soft text-warn' }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', t)}>{children}</span>;
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
      <dialog
        ref={ref}
        aria-label={term}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="sheet m-0 mt-auto w-full max-w-none rounded-t-3xl border-t border-line bg-surface p-0 text-ink shadow-2xl sm:m-auto sm:max-w-md sm:rounded-3xl sm:border"
      >
        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
          <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />
          <h2 className="text-lg font-semibold tracking-tight">{term}</h2>
          <p className="mt-2 leading-relaxed text-muted">{children}</p>
          <Button variant="secondary" block className="mt-5" onClick={close}>
            Ho capito
          </Button>
        </div>
      </dialog>
    </>
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
