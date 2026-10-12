'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { profileWarnings, saveInvestorProfile, useInvestorProfile, validateProfile, type ProfileErrors, type ProfileForm } from '@/lib/profileStore';

const EMPTY: ProfileForm = { age: '', horizonYears: '', retirementAge: '', netWorthEur: '', maxDrawdownPct: '', knowledge: '' };

export default function ProfiloPage() {
  const saved = useInvestorProfile();
  if (saved === undefined) return <p role="status">Caricamento…</p>;
  const initial: ProfileForm = saved
    ? {
        age: String(saved.age),
        horizonYears: String(saved.horizonYears),
        retirementAge: String(saved.retirementAge),
        netWorthEur: String(saved.netWorthEur),
        maxDrawdownPct: String(saved.maxDrawdownPct),
        knowledge: saved.knowledge,
      }
    : EMPTY;
  return <ProfiloForm initial={initial} isEdit={!!saved} />;
}

const inputCls =
  'mt-1 block w-full rounded border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 aria-[invalid=true]:border-slate-900 aria-[invalid=true]:border-2';

function ProfiloForm({ initial, isEdit }: { initial: ProfileForm; isEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [done, setDone] = useState(false);

  const set = (k: keyof ProfileForm) => (e: { target: { value: string } }) => {
    setDone(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = validateProfile(form);
    setErrors(r.errors);
    if (r.profile) {
      saveInvestorProfile(r.profile);
      if (isEdit) setDone(true);
      else router.push('/');
    }
  }

  const field = (id: keyof ProfileForm, label: string, hint: string, inputMode: 'numeric' | 'decimal' = 'numeric') => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-sm text-slate-700">
        {hint}
      </p>
      <input
        id={id}
        name={id}
        type="text"
        inputMode={inputMode}
        value={form[id]}
        onChange={set(id)}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={errors[id] ? `${id}-err ${id}-hint` : `${id}-hint`}
        className={inputCls}
      />
      {errors[id] && (
        <p id={`${id}-err`} className="mt-1 text-sm font-medium text-slate-900">
          {errors[id]}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profilo dell&apos;investitore</h1>
      <p className="mt-2 text-slate-700">
        {isEdit ? 'Modifica i dati del tuo profilo.' : 'Compila il profilo una volta sola: serve a confrontare i numeri dello strumento con i tuoi parametri.'}{' '}
        I dati restano salvati solo nel tuo browser.
      </p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        {field('age', 'Età', 'Anni compiuti')}
        {field('horizonYears', 'Orizzonte di investimento', 'In anni')}
        {field('retirementAge', 'Età di pensionamento obiettivo', 'In anni')}
        {field('netWorthEur', 'Patrimonio investito', 'In euro, anche approssimativo', 'decimal')}
        {field('maxDrawdownPct', 'Drawdown massimo tollerato', 'Perdita massima accettabile sull\'intero portafoglio, in % (esempio: 20)', 'decimal')}
        <fieldset aria-describedby={errors.knowledge ? 'knowledge-err' : undefined}>
          <legend className="block text-sm font-medium">Conoscenza finanziaria</legend>
          <p className="text-sm text-slate-700">Determina quanti dettagli vedi nel report.</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {(['base', 'intermedio', 'avanzato'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="knowledge"
                  value={k}
                  checked={form.knowledge === k}
                  onChange={set('knowledge')}
                  className="h-4 w-4 accent-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>
          {errors.knowledge && (
            <p id="knowledge-err" className="mt-1 text-sm font-medium text-slate-900">
              {errors.knowledge}
            </p>
          )}
        </fieldset>
        {profileWarnings(form).map((w) => (
          <p key={w} role="note" className="rounded border border-slate-300 bg-slate-50 p-3 text-sm">
            {w}
          </p>
        ))}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm font-medium">
            Controlla i campi evidenziati.
          </p>
        )}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded bg-blue-800 px-4 py-2 font-medium text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Salva profilo
          </button>
          {done && (
            <span role="status" className="text-sm">
              Profilo salvato.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
