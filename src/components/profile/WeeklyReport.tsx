import { useMemo } from 'react';
import { ClipboardCopy, Printer, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useNutritionTrackingStore, sumEntries, toISODate } from '../../store/nutrition-tracking';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useHealthProfileStore } from '../../store/health-profile';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';

const fmt = (n: number, digits = 0) => n.toLocaleString(undefined, { maximumFractionDigits: digits });

/** Médias dos últimos 7 dias frente às metas, para a pessoa (e o nutricionista) acompanhar. */
export function WeeklyReport() {
  const user = useAuthStore((s) => s.user);
  const entries = useNutritionTrackingStore((s) => s.entries);
  const goals = useNutritionGoalsStore((s) => s.goals);
  const weightLogs = useHealthProfileStore((s) => s.weightLogs);
  const { showToast } = useToastStore();
  const t = useTranslation();

  const report = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const min = toISODate(since);
    const recent = entries.filter((e) => e.date >= min);
    const days = new Set(recent.map((e) => e.date)).size;
    const totals = sumEntries(recent);
    const avg = (n: number) => (days ? n / days : 0);

    // Variação: último peso contra o último registro de pelo menos 7 dias antes (ou o primeiro).
    const last = weightLogs.at(-1);
    const before = [...weightLogs].reverse().find((w) => w.logged_on <= min) ?? weightLogs[0];
    const weightChange = last && before && last !== before ? last.weight_kg - before.weight_kg : null;

    return {
      days,
      calories: avg(totals.calories),
      protein: avg(totals.protein),
      carbs: avg(totals.carbs),
      fat: avg(totals.fat),
      fiber: avg(totals.fiber),
      weightChange,
    };
  }, [entries, weightLogs]);

  if (!report.days) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">{t.report.title}</p>
        <p className="mt-1">{t.report.noData}</p>
      </section>
    );
  }

  const pct = (value: number, goal: number) => (goal ? Math.round((value / goal) * 100) : 0);
  const labels = t.profile.nutritionGoalsnames;

  const summaryText = () =>
    [
      `${t.report.title} — ${user?.name ?? ''} (${t.report.subtitle.toLowerCase()})`,
      `${t.report.daysLogged}: ${report.days}/7`,
      `${labels.calories}: ${fmt(report.calories)} kcal (${pct(report.calories, goals.calories)}% ${t.report.vsGoal})`,
      `${labels.protein}: ${fmt(report.protein, 1)} g (${pct(report.protein, goals.protein)}%)`,
      `${labels.carbs}: ${fmt(report.carbs, 1)} g (${pct(report.carbs, goals.carbs)}%)`,
      `${labels.fat}: ${fmt(report.fat, 1)} g (${pct(report.fat, goals.fat)}%)`,
      `${labels.fiber}: ${fmt(report.fiber, 1)} g (${pct(report.fiber, goals.fiber)}%)`,
      report.weightChange !== null ? `${t.report.weightChange}: ${report.weightChange > 0 ? '+' : ''}${fmt(report.weightChange, 1)} kg` : '',
    ]
      .filter(Boolean)
      .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText());
      showToast(t.report.copied, 'success');
    } catch {
      showToast(t.shopping.error, 'error');
    }
  };

  const WeightIcon = report.weightChange === null || Math.abs(report.weightChange) < 0.05 ? Minus : report.weightChange > 0 ? TrendingUp : TrendingDown;

  const tiles = [
    { label: t.report.daysLogged, value: `${report.days}/7`, sub: null },
    { label: t.report.avgCalories, value: `${fmt(report.calories)} kcal`, sub: `${pct(report.calories, goals.calories)}% ${t.report.vsGoal}` },
    { label: t.report.avgProtein, value: `${fmt(report.protein, 1)} g`, sub: `${pct(report.protein, goals.protein)}% ${t.report.vsGoal}` },
    {
      label: t.report.weightChange,
      value: report.weightChange === null ? '—' : `${report.weightChange > 0 ? '+' : ''}${fmt(report.weightChange, 1)} kg`,
      sub: null,
      icon: WeightIcon,
    },
  ];

  return (
    <section className="print-area rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t.report.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.report.subtitle}</p>
        </div>
        <div className="flex gap-1.5 print:hidden">
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <ClipboardCopy className="h-3.5 w-3.5" />
            {t.report.copy}
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <Printer className="h-3.5 w-3.5" />
            {t.report.print}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">{tile.label}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-slate-900 dark:text-white">
              {tile.icon && <tile.icon className="h-4 w-4 text-slate-400" />}
              {tile.value}
            </p>
            {tile.sub && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{tile.sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
