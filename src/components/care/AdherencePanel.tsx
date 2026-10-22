import { useEffect, useState, type ReactNode } from 'react';
import { ClipboardCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { loadAdherence, type AdherenceResult } from '../../services/adherence';
import type { SlotStatus } from '../../lib/adherence';
import { cn } from '../../lib/utils';

const DOT: Record<SlotStatus, string> = {
  ate: 'bg-emerald-500',
  other: 'bg-amber-400',
  skipped: 'bg-rose-500',
  none: 'bg-slate-200 dark:bg-slate-700',
};

export function AdherencePanel({ clientId, reloadKey = 0 }: { clientId: string; reloadKey?: number }) {
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const a = t.adherence;
  const [result, setResult] = useState<AdherenceResult | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    loadAdherence(clientId, user.id)
      .then(setResult)
      .catch((error) => {
        console.error('Error loading adherence:', error);
        setResult(null);
      });
  }, [clientId, user, reloadKey]);

  if (result === undefined) return null;

  const legend = (st: SlotStatus) =>
    st === 'ate' ? a.legendAte : st === 'other' ? a.legendOther : st === 'skipped' ? a.legendSkipped : a.legendNone;

  const card = (body: ReactNode) => (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          {a.title}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.subtitle}</p>
      </div>
      {body}
    </section>
  );

  if (!result) return card(<p className="text-sm text-slate-500 dark:text-slate-400">{a.noPlan}</p>);
  const { current, previous } = result;
  if (current.percent === null) return card(<p className="text-sm text-slate-500 dark:text-slate-400">{a.noData}</p>);

  // Só compara se a semana anterior teve marcações (senão daria +X pts sem sentido).
  const previousMarked = previous.ate + previous.other + previous.skipped > 0;
  const delta = previous.percent === null || !previousMarked ? null : current.percent - previous.percent;
  const weekday = (date: string) => t.plan.days[(new Date(`${date}T12:00:00`).getDay() + 6) % 7];
  const offPlan = current.byMeal.filter((m) => m.off > 0).sort((x, y) => y.off / y.planned - x.off / x.planned);

  return card(
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="text-3xl font-bold text-slate-900 dark:text-white">
          {current.percent}%<span className="ml-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">{a.followed}</span>
        </p>
        {delta !== null && delta !== 0 && (
          <p className={cn('inline-flex items-center gap-1 text-xs font-semibold', delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {a.vsPrevious.replace('{delta}', `${delta > 0 ? '+' : ''}${delta}`)}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {a.counts
          .replace('{ate}', String(current.ate))
          .replace('{other}', String(current.other))
          .replace('{skipped}', String(current.skipped))
          .replace('{unmarked}', String(current.unmarked))}
      </p>

      {/* Grade dia × refeição */}
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th />
              {current.grid.map((g) => (
                <th key={g.date} className="px-1.5 pb-1 font-medium text-slate-500 dark:text-slate-400">
                  {weekday(g.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.byMeal.map(({ meal }) => (
              <tr key={meal}>
                <td className="whitespace-nowrap pr-2 text-slate-600 dark:text-slate-300">{t.plan.meals[meal]}</td>
                {current.grid.map((g) => {
                  const slot = g.slots.find((sl) => sl.meal === meal);
                  return (
                    <td key={g.date} className="px-1.5 py-1 text-center">
                      {slot ? (
                        <span className={cn('inline-block h-4 w-4 rounded', DOT[slot.status])} title={legend(slot.status)} />
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        {(['ate', 'other', 'skipped', 'none'] as SlotStatus[]).map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded', DOT[st])} />
            {legend(st)}
          </span>
        ))}
      </div>

      {offPlan.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{a.offPlan}</p>
          <ul className="space-y-1 text-sm">
            {offPlan.map((m) => (
              <li key={m.meal} className="text-slate-700 dark:text-slate-200">
                <span className="font-medium">{t.plan.meals[m.meal]}</span>
                <span className="text-slate-500 dark:text-slate-400"> — {a.offPlanCount.replace('{off}', String(m.off)).replace('{planned}', String(m.planned))}</span>
                {m.notes.length > 0 && <span className="block text-xs italic text-slate-500 dark:text-slate-400">“{m.notes.slice(0, 3).join('”, “')}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
