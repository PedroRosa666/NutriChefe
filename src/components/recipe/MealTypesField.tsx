import { Check } from 'lucide-react';
import { MEAL_SLOTS, type MealSlot } from '../../services/care';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

/**
 * Em quais refeições a receita serve. O gerador de plano usa a marcação para pôr a receita no
 * horário certo (sem ela, adivinha pelo nome). Nenhuma marcada = não informado.
 */
export function MealTypesField({ value, onChange }: { value: MealSlot[]; onChange: (next: MealSlot[]) => void }) {
  const t = useTranslation();
  const toggle = (slot: MealSlot) =>
    onChange(value.includes(slot) ? value.filter((s) => s !== slot) : MEAL_SLOTS.filter((s) => s === slot || value.includes(s)));

  return (
    <fieldset className="mt-4 space-y-2">
      <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.recipe.mealTypesLabel}</legend>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t.recipe.mealTypesHint}</p>
      <div className="flex flex-wrap gap-2">
        {MEAL_SLOTS.map((slot) => {
          const on = value.includes(slot);
          return (
            <button
              key={slot}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(slot)}
              className={cn(
                'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                on
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              )}
            >
              {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {t.plan.meals[slot]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
