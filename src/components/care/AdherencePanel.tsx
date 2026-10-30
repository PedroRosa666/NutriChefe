import { useEffect, useState, type ReactNode } from 'react';
import { Check, ClipboardCheck, Repeat, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { loadAdherence, type AdherenceResult } from '../../services/adherence';
import { MIN_PLANNED_FOR_PERCENT, type SlotStatus } from '../../lib/adherence';
import { cn } from '../../lib/utils';

// Cor e forma juntas: quem não distingue vermelho de verde lê pelo símbolo (WCAG 1.4.1).
const DOT: Record<SlotStatus, string> = {
  ate: 'bg-emerald-600 text-white',
  other: 'bg-amber-300 text-amber-950',
  skipped: 'bg-rose-600 text-white',
  none: 'bg-slate-200 dark:bg-slate-700',
};
const GLYPH: Partial<Record<SlotStatus, typeof Check>> = { ate: Check, other: Repeat, skipped: X };

function Dot({ status, size }: { status: SlotStatus; size: 'sm' | 'md' }) {
  const Icon = GLYPH[status];
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center justify-center rounded', size === 'md' ? 'h-5 w-5' : 'h-4 w-4', DOT[status])}>
      {Icon && <Icon className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} strokeWidth={3} />}
    </span>
  );
}

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
  const fewData = current.planned < MIN_PLANNED_FOR_PERCENT;
  const offPlan = current.byMeal.filter((m) => m.off > 0).sort((x, y) => y.off / y.planned - x.off / x.planned);

  return card(
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        {fewData ? (
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{a.fewData.replace('{n}', String(current.planned))}</p>
        ) : (
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {current.percent}%<span className="ml-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">{a.followed}</span>
          </p>
        )}
        {!fewData && delta !== null && delta !== 0 && (
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
              <th scope="col"><span className="sr-only">{a.mealColumn}</span></th>
              {current.grid.map((g) => (
                <th key={g.date} className="px-1.5 pb-1 font-medium text-slate-500 dark:text-slate-400">
                  {weekday(g.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.byMeal.map(({ mealId, name }) => (
              <tr key={mealId}>
                <td className="max-w-[9rem] truncate whitespace-nowrap pr-2 text-slate-600 dark:text-slate-300">{name}</td>
                {current.grid.map((g) => {
                  const slot = g.slots.find((sl) => sl.mealId === mealId);
                  return (
                    <td key={g.date} className="px-1.5 py-1 text-center">
                      {slot ? (
                        <span title={legend(slot.status)} className="inline-flex">
                          <Dot status={slot.status} size="md" />
                          <span className="sr-only">{legend(slot.status)}</span>
                        </span>
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
            <Dot status={st} size="sm" />
            {legend(st)}
          </span>
        ))}
      </div>

      {offPlan.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{a.offPlan}</p>
          <ul className="space-y-1 text-sm">
            {offPlan.map((m) => (
              <li key={m.mealId} className="text-slate-700 dark:text-slate-200">
                <span className="font-medium">{m.name}</span>
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
