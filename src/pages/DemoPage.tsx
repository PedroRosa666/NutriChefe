import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, Loader2, Stethoscope, User } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { usePremiumStore } from '../store/premium';
import { useTranslation } from '../hooks/useTranslation';
import { startDemo, type DemoRole } from '../services/demo';

/** Demonstração pública: link para currículo e LinkedIn, entra sem cadastro num par de contas demo. */
export function DemoPage() {
  const t = useTranslation();
  const d = t.demo;
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const isDemo = usePremiumStore((s) => s.isDemo);
  const [starting, setStarting] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Conta real aberta: entrar na demo trocaria a sessão sem a pessoa perceber.
  const realAccount = Boolean(user) && !isDemo;

  const start = async (as: DemoRole) => {
    setStarting(as);
    setError(null);
    try {
      await startDemo(as);
      navigate('/perfil');
    } catch (err) {
      setError((err as Error)?.message === 'rate_limited' ? d.rateLimited : d.error);
      setStarting(null);
    }
  };

  const roles = [
    { as: 'nutritionist' as const, icon: Stethoscope, label: d.asNutritionist, hint: d.asNutritionistHint },
    { as: 'patient' as const, icon: User, label: d.asPatient, hint: d.asPatientHint },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          <Bot className="h-3.5 w-3.5" />
          {d.badge}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">{d.title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-400">{d.subtitle}</p>
        <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">{d.author}</p>
      </div>

      {realAccount ? (
        <div className="mx-auto mt-8 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          <p>{d.signedIn}</p>
          <button type="button" onClick={() => signOut()} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700">
            {d.signOut}
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {roles.map(({ as, icon: Icon, label, hint }) => (
            <button
              key={as}
              type="button"
              disabled={starting !== null}
              onClick={() => start(as)}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-md disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-600"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                {starting === as ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">{starting === as ? d.starting : label}</span>
              <span className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{hint}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

      <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400">{d.notes}</p>

      <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/60">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{d.techTitle}</h2>
        <ul className="mt-3 space-y-2">
          {d.tech.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
