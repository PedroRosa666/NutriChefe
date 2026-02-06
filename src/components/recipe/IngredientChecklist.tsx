import { useState } from 'react';
import { UtensilsCrossed, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

interface IngredientChecklistProps {
  ingredients: string[];
}

export function IngredientChecklist({ ingredients }: IngredientChecklistProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const t = useTranslation();

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const total = ingredients.length;
  const done = checked.size;
  const progress = total > 0 ? (done / total) * 100 : 0;
  const allDone = done === total && total > 0;

  const countLabel =
    total === 1
      ? t.recipe.ingredientsCountSingular || 'item'
      : t.recipe.ingredientsCountPlural || 'itens';

  return (
    <div className="bg-white dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
            <UtensilsCrossed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          {t.recipe.ingredients}
        </h3>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
          {total} {countLabel}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t.recipe.checkIngredients}
          </span>
          <span
            className={cn(
              'text-xs font-semibold',
              allDone
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {done}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              allDone
                ? 'bg-emerald-500'
                : 'bg-emerald-400 dark:bg-emerald-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {allDone && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 border border-emerald-100 dark:border-emerald-800/40">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {t.recipe.checkedAll}
          </span>
        </div>
      )}

      <ul className="space-y-1.5">
        {ingredients.map((ingredient, index) => {
          const isChecked = checked.has(index);
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className={cn(
                  'w-full flex items-center gap-3 text-sm leading-relaxed rounded-lg px-2.5 py-2 transition-all duration-200 text-left',
                  isChecked
                    ? 'bg-emerald-50/60 dark:bg-emerald-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                )}
              >
                <span
                  className={cn(
                    'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-xs font-semibold transition-all duration-200 border',
                    isChecked
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {isChecked ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    'flex-1 transition-all duration-200',
                    isChecked
                      ? 'line-through text-gray-400 dark:text-gray-500'
                      : 'text-gray-700 dark:text-gray-200'
                  )}
                >
                  {ingredient}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
