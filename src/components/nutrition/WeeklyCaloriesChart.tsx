import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { sumEntries, toISODate, type NutritionLogEntry } from '../../store/nutrition-tracking';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettingsStore } from '../../store/settings';
import { cn } from '../../lib/utils';

interface WeeklyCaloriesChartProps {
  entries: NutritionLogEntry[];
  goal: number;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

/** Calorias dos últimos 7 dias, com a meta diária como linha de referência. */
export function WeeklyCaloriesChart({ entries, goal, selectedDate, onSelectDate }: WeeklyCaloriesChartProps) {
  const t = useTranslation();
  const { language } = useSettingsStore();

  const days = useMemo(() => {
    const result: { date: string; label: string; calories: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = toISODate(d);
      result.push({
        date,
        label: d.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'short' }).replace('.', ''),
        calories: sumEntries(entries.filter((e) => e.date === date)).calories,
      });
    }
    return result;
  }, [entries, language]);

  const max = Math.max(goal, ...days.map((d) => d.calories), 1);
  const logged = days.filter((d) => d.calories > 0);
  const average = logged.length ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : 0;
  const goalPct = (goal / max) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          {t.profile.last7Days}
        </h4>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t.profile.dailyAverage}: <strong className="text-slate-700 dark:text-slate-200">{average} kcal</strong>
        </span>
      </div>

      <div className="h-36 rounded-xl border border-slate-100 bg-slate-50 px-2 pt-4 pb-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="relative h-full">
        {goal > 0 && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-emerald-500/70"
            style={{ bottom: `${goalPct}%` }}
            aria-hidden
          >
            <span className="absolute -top-4 right-0 text-[10px] text-emerald-600 dark:text-emerald-400">
              {t.profile.goalLabel} {goal}
            </span>
          </div>
        )}
        <div className="flex h-full items-end gap-2">
          {days.map((d) => {
            const over = goal > 0 && d.calories > goal * 1.1;
            const isSelected = d.date === selectedDate;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => onSelectDate?.(d.date)}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                title={`${d.calories.toFixed(0)} kcal`}
                aria-label={`${d.label}: ${d.calories.toFixed(0)} kcal`}
              >
                <div
                  className={cn(
                    'w-full max-w-[28px] rounded-t-md transition-all',
                    d.calories === 0
                      ? 'bg-slate-200 dark:bg-slate-800'
                      : over
                        ? 'bg-rose-400'
                        : 'bg-emerald-500 group-hover:bg-emerald-400',
                    isSelected && 'ring-2 ring-offset-1 ring-emerald-600 ring-offset-slate-50 dark:ring-offset-slate-950'
                  )}
                  style={{ height: `${Math.max(3, (d.calories / max) * 100)}%` }}
                />
                <span
                  className={cn(
                    'absolute -bottom-5 text-[10px] capitalize',
                    isSelected ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
