import { useMemo, useState } from 'react';
import { Loader2, Sparkles, Trash2, Save } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { MEAL_SLOTS, planDayOf, savePlan, type MealPlan, type MealPlanItem } from '../../services/care';
import { generateWeeklyPlan } from '../../lib/meal-plan-generator';
import { cn } from '../../lib/utils';
import type { Recipe } from '../../types/recipe';

interface MealPlanEditorProps {
  clientId: string;
  recipes: Recipe[];
  plan?: MealPlan | null;
  dailyCalories: number;
  allergies: string[];
  preferences: string[];
  /** Abre já com um cardápio gerado. */
  startGenerated?: boolean;
  onSaved: (plan: MealPlan) => void;
  onCancel: () => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

export function MealPlanEditor({
  clientId,
  recipes,
  plan,
  dailyCalories,
  allergies,
  preferences,
  startGenerated,
  onSaved,
  onCancel,
}: MealPlanEditorProps) {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();

  const generate = () =>
    generateWeeklyPlan({ recipes, dailyCalories, allergies, preferences });

  const [title, setTitle] = useState(plan?.title ?? '');
  const [notes, setNotes] = useState(plan?.notes ?? '');
  const [items, setItems] = useState<MealPlanItem[]>(() => plan?.items ?? (startGenerated ? generate() : []));
  const [day, setDay] = useState(() => planDayOf(new Date()));
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const sortedRecipes = useMemo(() => recipes.slice().sort((a, b) => a.title.localeCompare(b.title)), [recipes]);

  const dayCalories = (d: number) =>
    items
      .filter((i) => i.day === d)
      .reduce((sum, i) => sum + (byId.get(i.recipe_id)?.nutritionFacts.calories ?? 0) * i.servings, 0);

  const regenerate = () => {
    const next = generate();
    if (!next.length) {
      showToast(t.plan.generateEmpty, 'warning');
      return;
    }
    setItems(next);
    showToast(t.plan.generated, 'success');
  };

  const addItem = (meal: MealPlanItem['meal'], recipeId: string) => {
    if (!recipeId) return;
    setItems((prev) => [...prev, { day, meal, recipe_id: recipeId, servings: 1, note: '' }]);
  };

  const updateItem = (target: MealPlanItem, patch: Partial<MealPlanItem>) =>
    setItems((prev) => prev.map((i) => (i === target ? { ...i, ...patch } : i)));

  const removeItem = (target: MealPlanItem) => setItems((prev) => prev.filter((i) => i !== target));

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const saved = await savePlan({
        id: plan?.id,
        clientId,
        authorId: user.id,
        title: title || t.plan.title,
        notes,
        items: items.filter((i) => byId.has(i.recipe_id)),
      });
      showToast(t.plan.saved, 'success');
      onSaved(saved);
    } catch (error) {
      console.error('Error saving plan:', error);
      showToast(t.plan.saveError, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t.plan.titleLabel}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t.plan.titlePlaceholder} className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t.plan.notesLabel}</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder={t.plan.notesPlaceholder} className={inputClass} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t.plan.goalHint.replace('{kcal}', String(Math.round(dailyCalories)))}
        </p>
        <button
          type="button"
          onClick={regenerate}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
        >
          <Sparkles className="h-4 w-4" />
          {items.length ? t.plan.regenerate : t.plan.generate}
        </button>
      </div>

      {/* Dias da semana com o total de calorias de cada um */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {t.plan.days.map((label, d) => {
          const kcal = Math.round(dayCalories(d));
          return (
            <button
              key={label}
              type="button"
              onClick={() => setDay(d)}
              className={cn(
                'flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors',
                d === day
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
              )}
            >
              <span className="font-semibold">{label}</span>
              <span className={cn('text-[11px]', d === day ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400')}>
                {kcal ? `${kcal} kcal` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEAL_SLOTS.map((meal) => {
          const mealItems = items.filter((i) => i.day === day && i.meal === meal);
          return (
            <div key={meal} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t.plan.meals[meal]}</p>
              <div className="space-y-2">
                {mealItems.map((item, index) => {
                  const recipe = byId.get(item.recipe_id);
                  if (!recipe) return null;
                  return (
                    <div key={`${item.recipe_id}-${index}`} className="flex items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-900">
                      <img src={recipe.image} alt="" className="h-9 w-9 flex-shrink-0 rounded-md bg-slate-100 object-cover dark:bg-slate-800" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{recipe.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {Math.round(recipe.nutritionFacts.calories * item.servings)} kcal
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0.5}
                        max={20}
                        step={0.5}
                        value={item.servings}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v > 0 && v <= 20) updateItem(item, { servings: v });
                        }}
                        className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        aria-label={t.plan.servingsShort}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                        aria-label={t.profile.remove}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                <select
                  value=""
                  onChange={(e) => addItem(meal, e.target.value)}
                  className="w-full rounded-lg border border-dashed border-slate-300 bg-transparent px-2 py-1.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
                >
                  <option value="">{t.plan.addRecipe}</option>
                  {sortedRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({Math.round(r.nutritionFacts.calories)} kcal)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t.plan.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t.plan.save}
        </button>
      </div>
    </div>
  );
}
