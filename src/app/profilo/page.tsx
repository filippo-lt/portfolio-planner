'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flash, profileWarnings, saveInvestorProfile, useInvestorProfile, validateProfile, type ProfileErrors, type ProfileForm } from '@/lib/profileStore';
import { parseItDecimal } from '@/lib/profileValidation';
import type { Knowledge } from '@/lib/profileFit';
import { Button, ButtonLink, Callout, Card, PageLoading, cx } from '@/components/ui';

const EMPTY: ProfileForm = { age: '', horizonYears: '', retirementAge: '', netWorthEur: '', maxDrawdownPct: '', knowledge: '' };

const eur = (n: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n);

export default function ProfiloPage() {
  const saved = useInvestorProfile();
  if (saved === undefined) return <PageLoading />;
  const initial: ProfileForm = saved
    ? {
        age: String(saved.age),
        horizonYears: String(saved.horizonYears),
        retirementAge: String(saved.retirementAge),
        netWorthEur: eur(saved.netWorthEur),
        maxDrawdownPct: String(saved.maxDrawdownPct).replace('.', ','),
        knowledge: saved.knowledge,
      }
    : EMPTY;
  return saved ? <EditProfile initial={initial} /> : <Onboarding />;
}

/* ---------- fields ---------- */

type FieldId = Exclude<keyof ProfileForm, 'knowledge'>;

interface FieldDef {
  id: FieldId;
  label: string;
  hint: string;
  prefix?: string;
  suffix?: string;
  decimal?: boolean;
  placeholder?: string;
}

const FIELDS: Record<FieldId, FieldDef> = {
  age: { id: 'age', label: 'Quanti anni hai?', hint: 'Anni compiuti.', suffix: 'anni', placeholder: 'es. 35' },
  retirementAge: {
    id: 'retirementAge',
    label: 'A che età vorresti andare in pensione?',
    hint: 'Anche indicativa.',
    suffix: 'anni',
    placeholder: 'es. 67',
  },
  horizonYears: {
    id: 'horizonYears',
    label: 'Per quanti anni pensi di tenere investito il denaro?',
    hint: 'È il tuo orizzonte di investimento: il tempo prima di aver bisogno di quei soldi.',
    suffix: 'anni',
    placeholder: 'es. 10',
  },
  netWorthEur: {
    id: 'netWorthEur',
    label: 'Quanto hai investito in totale?',
    hint: 'In euro, anche approssimativo. Puoi scrivere 50000 o 50.000.',
    prefix: '€',
    decimal: true,
    placeholder: 'es. 50.000',
  },
  maxDrawdownPct: {
    id: 'maxDrawdownPct',
    label: 'Quanto saresti disposto a perdere, al massimo, in un periodo negativo?',
    hint: "In percentuale sull'intero portafoglio, rispetto al suo valore più alto. Questo dato si chiama anche “drawdown massimo tollerato”.",
    suffix: '%',
    decimal: true,
    placeholder: 'es. 20',
  },
};

const KNOWLEDGE: { value: Knowledge; title: string; desc: string }[] = [
  { value: 'base', title: 'Base', desc: 'Pochi numeri chiave, con spiegazioni.' },
  { value: 'intermedio', title: 'Intermedio', desc: 'Rendimenti per periodo, volatilità, confronto e composizione.' },
  { value: 'avanzato', title: 'Avanzato', desc: 'Tutti i dati disponibili, con date e note di calcolo.' },
];

function useFormState(initial: ProfileForm) {
  const [form, setForm] = useState<ProfileForm>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  // Errors clear on blur / explicit choice, not on each keystroke, so the layout doesn't jump while typing.
  const setField = (k: keyof ProfileForm, v: string, recheck = false) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (recheck && errors[k]) setErrors((e) => ({ ...e, [k]: validateProfile(next).errors[k] }));
  };
  const recheck = (k: keyof ProfileForm, value = form[k]) => {
    if (errors[k]) setErrors((e) => ({ ...e, [k]: validateProfile({ ...form, [k]: value }).errors[k] }));
  };
  return { form, setForm, errors, setErrors, setField, recheck };
}

function focusFirstError(errs: ProfileErrors, order: (keyof ProfileForm)[]) {
  const first = order.find((k) => errs[k]);
  if (!first) return;
  const el = document.getElementById(first === 'knowledge' ? 'knowledge-base' : first);
  el?.focus();
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function NumberField({
  def,
  value,
  error,
  onChange,
  onBlur,
  last,
  children,
}: {
  def: FieldDef;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  last?: boolean;
  children?: ReactNode;
}) {
  const { id } = def;
  const describedBy = [error && `${id}-err`, `${id}-hint`].filter(Boolean).join(' ');
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold leading-snug">
        {def.label}
      </label>
      <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
        {def.hint}
      </p>
      <div
        className={cx(
          'mt-2 flex min-h-13 items-center rounded-xl border bg-surface px-4 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25',
          error ? 'border-error ring-2 ring-error/20' : 'border-line-strong/60',
        )}
      >
        {def.prefix && (
          <span className="mr-2 text-muted" aria-hidden="true">
            {def.prefix}
          </span>
        )}
        <input
          id={id}
          name={id}
          type="text"
          inputMode={def.decimal ? 'decimal' : 'numeric'}
          enterKeyHint={last ? 'done' : 'next'}
          autoComplete="off"
          placeholder={def.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const n = parseItDecimal(value);
            const v = id === 'netWorthEur' && Number.isFinite(n) ? eur(n) : value;
            if (v !== value) onChange(v);
            onBlur?.(v);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 w-full min-w-0 bg-transparent text-lg tabular-nums outline-none placeholder:text-muted/50"
          style={{ outline: 'none' }}
        />
        {def.suffix && (
          <span className="ml-2 text-muted" aria-hidden="true">
            {def.suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-error">
          <ErrIcon />
          {error}
        </p>
      )}
      {children}
    </div>
  );
}

function ErrIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5.8v5M10 13.8v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DrawdownExtras({ form, setField }: { form: ProfileForm; setField: (k: keyof ProfileForm, v: string, recheck?: boolean) => void }) {
  const dd = parseItDecimal(form.maxDrawdownPct);
  const worth = parseItDecimal(form.netWorthEur);
  const ok = Number.isFinite(dd) && dd >= 1 && dd <= 99;
  return (
    <>
      <div className="mt-3 grid max-w-sm grid-cols-5 gap-1.5" role="group" aria-label="Valori rapidi">
        {[10, 20, 30, 40, 50].map((v) => {
          const on = ok && dd === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setField('maxDrawdownPct', String(v), true)}
              aria-pressed={on}
              className={cx(
                'pressable min-h-11 rounded-full border text-sm font-medium tabular-nums',
                on ? 'border-accent bg-accent text-accent-fg' : 'border-accent/25 bg-surface text-accent hover:border-accent/60 hover:bg-accent-soft',
              )}
            >
              {v}%
            </button>
          );
        })}
      </div>
      {Number.isFinite(worth) && worth > 0 && (
        // Space is reserved up front so the cards below never move under the user's finger.
        <p className={cx('mt-3 flex min-h-[3.25rem] items-center rounded-xl px-4 py-2 text-sm', ok ? 'bg-error-soft' : 'bg-surface-2')} aria-live="polite">
          {ok ? (
            <span>
              Con {eur(worth)} € investiti, una perdita del {String(dd).replace('.', ',')}% corrisponde a circa{' '}
              <strong className="tabular-nums text-error">−{eur(Math.round((worth * dd) / 100))} €</strong>.
            </span>
          ) : (
            <span className="text-muted">Scegli una percentuale per vedere a quanti euro corrisponde.</span>
          )}
        </p>
      )}
    </>
  );
}

function KnowledgeField({ value, error, onChange }: { value: string; error?: string; onChange: (v: Knowledge) => void }) {
  return (
    <fieldset aria-describedby={error ? 'knowledge-err knowledge-hint' : 'knowledge-hint'}>
      <legend className="text-base font-semibold">Quanto ti senti a tuo agio con i termini finanziari?</legend>
      <p id="knowledge-hint" className="mt-1 text-sm text-muted">
        Decide quanti dettagli vedi nel report. Puoi cambiarlo in ogni momento.
      </p>
      <div className="mt-3 space-y-2">
        {KNOWLEDGE.map((k) => {
          const on = value === k.value;
          return (
            <label
              key={k.value}
              className={cx(
                'pressable flex cursor-pointer items-start gap-3 rounded-xl border bg-surface p-4',
                on ? 'border-accent ring-2 ring-accent/25' : error ? 'border-error' : 'border-line hover:border-line-strong',
              )}
            >
              <input
                id={`knowledge-${k.value}`}
                type="radio"
                name="knowledge"
                value={k.value}
                checked={on}
                onChange={() => onChange(k.value)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-semibold">{k.title}</span>
                <span className="block text-sm text-muted">{k.desc}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="knowledge-err" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-error">
          <ErrIcon />
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ---------- first run: guided steps ---------- */

const STEPS: { title: string; intro: string; fields: (keyof ProfileForm)[] }[] = [
  { title: 'Su di te', intro: 'Due numeri per capire in che fase della vita sei.', fields: ['age', 'retirementAge'] },
  { title: 'I tuoi investimenti', intro: 'Servono a mettere in proporzione i dati di ogni strumento.', fields: ['horizonYears', 'netWorthEur'] },
  {
    title: 'Rischio e dettaglio',
    intro: "L'ultimo passo: quanta oscillazione accetti e quanti dettagli vuoi vedere.",
    fields: ['maxDrawdownPct', 'knowledge'],
  },
];

function Onboarding() {
  const router = useRouter();
  const { form, errors, setErrors, setField, recheck } = useFormState(EMPTY);
  const [step, setStep] = useState(-1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step >= 0) headingRef.current?.focus();
  }, [step]);

  if (step < 0) {
    return (
      <div className="rise mx-auto flex min-h-[calc(100dvh-10.5rem)] max-w-xl flex-col">
        <div className="flex-1">
          <span aria-hidden="true" className="btn-primary grid h-14 w-14 place-items-center rounded-2xl text-accent-fg">
            <svg viewBox="0 0 24 24" className="h-7 w-7">
              <path d="M4 17l5-5 4 4 7-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Capisci i numeri di un ETF o di un&apos;azione, rispetto a te.</h1>
          <p className="mt-3 text-lg text-muted">
            Cerchi uno strumento e ottieni un report con dati e confronti numerici, messi in relazione con il tuo profilo.
          </p>
          <ol className="mt-8 space-y-4">
            {[
              ['1', 'Crea il tuo profilo', '3 brevi passaggi, circa un minuto.'],
              ['2', 'Cerca uno strumento', 'Con ISIN, ticker o nome.'],
              ['3', 'Leggi il report', 'Costi, rendimenti, rischio e confronto con il tuo profilo.'],
            ].map(([n, t, d]) => (
              <li key={n} className="flex gap-4">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {n}
                </span>
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="block text-sm text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex items-center gap-2 text-sm text-muted">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-success">
              <rect x="4" y="9" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            I dati restano solo su questo dispositivo.
          </p>
        </div>
        <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-bg/85 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
          <Button block onClick={() => setStep(0)}>
            Inizia
          </Button>
        </div>
      </div>
    );
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  function next(e: React.FormEvent) {
    e.preventDefault();
    const r = validateProfile(form);
    const stepErrs: ProfileErrors = {};
    for (const k of s.fields) if (r.errors[k]) stepErrs[k] = r.errors[k];
    setErrors(stepErrs);
    if (Object.keys(stepErrs).length) {
      focusFirstError(stepErrs, s.fields);
      return;
    }
    if (!last) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    if (r.profile) {
      saveInvestorProfile(r.profile);
      flash.welcome = true;
      router.push('/');
    }
  }

  const warnings = s.fields.includes('horizonYears') ? profileWarnings(form) : [];

  return (
    <form onSubmit={next} noValidate className="mx-auto flex min-h-[calc(100dvh-10.5rem)] max-w-xl flex-col">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          aria-label="Indietro"
          className="pressable -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-surface-2"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
            <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'btn-primary' : 'bg-surface-2')} />
          ))}
        </div>
        <span className="text-sm tabular-nums text-muted">
          {step + 1} di {STEPS.length}
        </span>
      </div>

      <div key={step} className="rise flex-1">
        <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-semibold tracking-tight outline-none">
          {s.title}
        </h1>
        <p className="mt-1 text-muted">{s.intro}</p>
        <div className="mt-6 space-y-7">
          {s.fields.map((k, i) =>
            k === 'knowledge' ? (
              <KnowledgeField key={k} value={form.knowledge} error={errors.knowledge} onChange={(v) => setField('knowledge', v, true)} />
            ) : (
              <NumberField
                key={k}
                def={FIELDS[k]}
                value={form[k]}
                error={errors[k]}
                onChange={(v) => setField(k, v)}
                onBlur={(v) => recheck(k, v)}
                last={i === s.fields.length - 1}
              >
                {k === 'maxDrawdownPct' && <DrawdownExtras form={form} setField={setField} />}
              </NumberField>
            ),
          )}
          {warnings.map((w) => (
            <Callout key={w} tone="worry" role="note">
              {w}
            </Callout>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-bg/85 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        {s.fields.some((k) => errors[k]) && (
          <p role="alert" className="mb-2 text-center text-sm font-medium text-error">
            Completa i campi evidenziati per continuare.
          </p>
        )}
        <Button type="submit" block>
          {last ? 'Salva e inizia a cercare' : 'Continua'}
        </Button>
      </div>
    </form>
  );
}

/* ---------- edit mode: everything on one page ---------- */

const ORDER: (keyof ProfileForm)[] = ['age', 'retirementAge', 'horizonYears', 'netWorthEur', 'maxDrawdownPct', 'knowledge'];

function EditProfile({ initial }: { initial: ProfileForm }) {
  const { form, setForm, errors, setErrors, setField, recheck } = useFormState(initial);
  const [savedAt, setSavedAt] = useState<ProfileForm | null>(null);
  const baseline = savedAt ?? initial;
  const dirty = ORDER.some((k) => form[k] !== baseline[k]);
  const showSaved = savedAt !== null && !dirty;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = validateProfile(form);
    setErrors(r.errors);
    if (!r.profile) {
      focusFirstError(r.errors, ORDER);
      return;
    }
    saveInvestorProfile(r.profile);
    setSavedAt(form);
  }

  const errCount = ORDER.filter((k) => errors[k]).length;

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Il tuo profilo</h1>
      <p className="mt-1 text-muted">I report confrontano i dati di ogni strumento con questi valori. Restano solo su questo dispositivo.</p>

      {errCount > 0 && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-error-soft px-4 py-3 text-sm font-medium text-error">
          <ErrIcon />
          {errCount === 1 ? 'Un campo da correggere.' : `${errCount} campi da correggere.`}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <Card className="space-y-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Su di te</h2>
          <NumberField def={FIELDS.age} value={form.age} error={errors.age} onChange={(v) => setField('age', v)} onBlur={(v) => recheck('age', v)} />
          <NumberField
            def={FIELDS.retirementAge}
            value={form.retirementAge}
            error={errors.retirementAge}
            onChange={(v) => setField('retirementAge', v)}
            onBlur={(v) => recheck('retirementAge', v)}
          />
        </Card>
        <Card className="space-y-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">I tuoi investimenti</h2>
          <NumberField
            def={FIELDS.horizonYears}
            value={form.horizonYears}
            error={errors.horizonYears}
            onChange={(v) => setField('horizonYears', v)}
            onBlur={(v) => recheck('horizonYears', v)}
          />
          <NumberField
            def={FIELDS.netWorthEur}
            value={form.netWorthEur}
            error={errors.netWorthEur}
            onChange={(v) => setField('netWorthEur', v)}
            onBlur={(v) => recheck('netWorthEur', v)}
          />
          {profileWarnings(form).map((w) => (
            <Callout key={w} tone="worry" role="note">
              {w}
            </Callout>
          ))}
        </Card>
        <Card className="space-y-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Rischio e dettaglio</h2>
          <NumberField
            def={FIELDS.maxDrawdownPct}
            value={form.maxDrawdownPct}
            error={errors.maxDrawdownPct}
            onChange={(v) => setField('maxDrawdownPct', v)}
            onBlur={(v) => recheck('maxDrawdownPct', v)}
            last
          >
            <DrawdownExtras form={form} setField={setField} />
          </NumberField>
          <KnowledgeField value={form.knowledge} error={errors.knowledge} onChange={(v) => setField('knowledge', v, true)} />
        </Card>
      </div>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] -mx-4 mt-6 border-t border-line bg-bg/85 px-4 py-3 backdrop-blur-md empty:hidden sm:bottom-0 sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
        {!dirty && !showSaved ? null : showSaved ? (
          <div role="status" className="rise flex items-center gap-3 rounded-xl border border-success-line bg-success-soft p-2 pl-4">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 shrink-0 text-success">
              <path d="M4.5 10.5 8.5 14.5 15.5 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex-1 text-sm font-semibold text-success">Profilo salvato</span>
            <ButtonLink href="/" variant="primary" className="min-h-11 px-4 text-sm">
              Vai alla ricerca
            </ButtonLink>
          </div>
        ) : (
          <div className="rise flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setForm(baseline);
                setErrors({});
              }}
            >
              Annulla
            </Button>
            <Button type="submit" className="flex-1">
              Salva modifiche
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
