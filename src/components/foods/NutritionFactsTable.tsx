import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import { useTranslation } from '../../hooks/useTranslation';
import { nutrientsFor } from '../../lib/food-math';
import { EXTRA_NUTRIENTS, scaleExtraNutrients, type NutrientGroup } from '../../lib/nutrients';
import type { Food } from '../../services/foods';

const GROUPS: NutrientGroup[] = ['fats', 'minerals', 'vitamins', 'energy'];

const fmt = (n: number, lang: string) => n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 2 });

/** Tabela nutricional completa de `grams` gramas de um alimento. "—" = não analisado na fonte. */
export function NutritionFactsTable({ food, grams }: { food: Food; grams: number }) {
  const t = useTranslation();
  const n = t.nutritionFacts;
  const language = useSettingsStore((s) => s.language);
  const main = useMemo(() => nutrientsFor(food, grams), [food, grams]);
  const extra = useMemo(() => scaleExtraNutrients(food.nutrients, grams), [food, grams]);
  const sodium = food.sodium === null ? null : Math.round((food.sodium * grams) / 100);

  const mainRows: [string, string][] = [
    [n.energy, `${main.calories} kcal`],
    [n.protein, `${fmt(main.protein, language)} g`],
    [n.carbs, `${fmt(main.carbs, language)} g`],
    [n.fat, `${fmt(main.fat, language)} g`],
    [n.fiber, `${fmt(main.fiber, language)} g`],
    [n.sodium, sodium === null ? '—' : `${fmt(sodium, language)} mg`],
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {n.title} • {fmt(grams, language)} g
      </p>
      <dl className="divide-y divide-slate-100 px-3 dark:divide-slate-800">
        {mainRows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-1.5">
            <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
            <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
      {GROUPS.map((group) => {
        const rows = EXTRA_NUTRIENTS.filter((info) => info.group === group);
        return (
          <details key={group} className="group border-t border-slate-200 dark:border-slate-700">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {n.groups[group]}
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="divide-y divide-slate-100 px-3 pb-2 dark:divide-slate-800">
              {rows.map((info) => {
                const value = extra[info.key];
                return (
                  <div key={info.key} className="flex justify-between gap-3 py-1.5">
                    <dt className="text-slate-600 dark:text-slate-300">{language === 'pt' ? info.pt : info.en}</dt>
                    <dd className="tabular-nums text-slate-900 dark:text-white">
                      {value === undefined ? '—' : `${fmt(value, language)} ${info.unit}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </details>
        );
      })}
      <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700">
        {food.taco_id ? n.sourceTaco : n.sourceCustom} {n.notAnalyzed}
      </p>
    </div>
  );
}
