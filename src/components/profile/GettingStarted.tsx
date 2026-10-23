import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Circle, Rocket, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { gettingStartedKey, isGettingStartedHidden } from '../../lib/getting-started';

export interface GettingStartedStep {
  key: string;
  label: string;
  hint?: string;
  done: boolean;
  to: string;
}


/**
 * Primeiros passos de quem acabou de chegar: uma lista curta com o que falta e o atalho de cada item.
 * Some sozinho quando tudo está feito, ou quando a pessoa fecha.
 */
export function GettingStarted({ userId, steps, onHide }: { userId: string; steps: GettingStartedStep[]; onHide?: () => void }) {
  const t = useTranslation();
  const u = t.profileUi;
  const [hidden, setHidden] = useState(() => isGettingStartedHidden(userId));
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;

  const hide = () => {
    setHidden(true);
    onHide?.();
    try {
      localStorage.setItem(gettingStartedKey(userId), '1');
    } catch {
      // Sem armazenamento: volta a aparecer na próxima visita, sem prejuízo.
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900/50 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Rocket className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{u.gettingStarted}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {u.gettingStartedProgress.replace('{n}', String(done)).replace('{total}', String(steps.length))}
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label={u.hideGettingStarted}
          title={u.hideGettingStarted}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              to={step.to}
              className={cn('flex items-center gap-3 py-2.5', step.done ? 'pointer-events-none' : 'group')}
              aria-disabled={step.done}
              tabIndex={step.done ? -1 : undefined}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 flex-shrink-0 text-slate-300 dark:text-slate-600" />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-sm',
                    step.done ? 'text-slate-400 line-through' : 'font-medium text-slate-800 group-hover:text-emerald-700 dark:text-slate-100'
                  )}
                >
                  {step.label}
                </span>
                {step.hint && !step.done && <span className="block text-xs text-slate-500 dark:text-slate-400">{step.hint}</span>}
              </span>
              {!step.done && <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 group-hover:text-emerald-600" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
