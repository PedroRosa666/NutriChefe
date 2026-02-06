import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

interface NutritionPanelProps {
  nutritionFacts: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
}

const DAILY_REF = { calories: 2000, protein: 50, carbs: 300, fat: 65, fiber: 25 };
const RADIUS = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function NutritionPanel({ nutritionFacts }: NutritionPanelProps) {
  const t = useTranslation();
  const calPct = Math.min(100, (nutritionFacts.calories / DAILY_REF.calories) * 100);
  const calDash = (calPct / 100) * CIRCUMFERENCE;

  const macros = [
    { key: 'protein', label: t.profile.nutritionGoalsnames.protein, value: nutritionFacts.protein, daily: DAILY_REF.protein, bar: 'bg-blue-500', track: 'bg-blue-100/60 dark:bg-blue-950/40' },
    { key: 'carbs', label: t.profile.nutritionGoalsnames.carbs, value: nutritionFacts.carbs, daily: DAILY_REF.carbs, bar: 'bg-teal-500', track: 'bg-teal-100/60 dark:bg-teal-950/40' },
    { key: 'fat', label: t.profile.nutritionGoalsnames.fat, value: nutritionFacts.fat, daily: DAILY_REF.fat, bar: 'bg-amber-500', track: 'bg-amber-100/60 dark:bg-amber-950/40' },
    { key: 'fiber', label: t.profile.nutritionGoalsnames.fiber, value: nutritionFacts.fiber, daily: DAILY_REF.fiber, bar: 'bg-green-500', track: 'bg-green-100/60 dark:bg-green-950/40' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t.recipe.nutritionFacts}
        </h3>
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-center gap-4 py-4 mb-3 border-b border-gray-100 dark:border-gray-700/50">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28" cy="28" r={RADIUS}
                fill="none" strokeWidth="4"
                className="stroke-gray-100 dark:stroke-gray-700"
              />
              <circle
                cx="28" cy="28" r={RADIUS}
                fill="none" strokeWidth="4"
                strokeDasharray={`${calDash} ${CIRCUMFERENCE}`}
                strokeLinecap="round"
                className="stroke-emerald-500 transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-gray-900 dark:text-white leading-none">
                {nutritionFacts.calories.toFixed(0)}
              </span>
              <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">kcal</span>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {t.profile.nutritionGoalsnames.calories}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t.recipe.perServing}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {macros.map((m) => {
            const pct = Math.min(100, (m.value / m.daily) * 100);
            return (
              <div key={m.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{m.label}</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{m.value.toFixed(1)}g</span>
                </div>
                <div className={cn('h-1.5 rounded-full overflow-hidden', m.track)}>
                  <div
                    className={cn('h-full rounded-full transition-all duration-500 ease-out', m.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
