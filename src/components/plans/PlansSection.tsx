import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Pencil, Plus, ShoppingCart, Sparkles, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useToastStore } from '../../store/toast';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useShoppingListStore } from '../../store/shopping-list';
import { useTranslation } from '../../hooks/useTranslation';
import { deletePlan, listPlans, MEAL_SLOTS, planDayOf, type MealPlan } from '../../services/care';
import { MealPlanEditor } from './MealPlanEditor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '../../lib/utils';

interface PlansSectionProps {
  clientId: string;
  /** 'client': o próprio cliente; 'nutritionist': visto pelo nutricionista do paciente. */
  mode: 'client' | 'nutritionist';
  dailyCalories: number;
  allergies: string[];
  preferences: string[];
}

export function PlansSection({ clientId, mode, dailyCalories, allergies, preferences }: PlansSectionProps) {
  const user = useAuthStore((s) => s.user);
  const recipes = useRecipesStore((s) => s.recipes);
  const { showToast } = useToastStore();
  const t = useTranslation();

  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ plan: MealPlan | null; generated: boolean } | null>(null);
  const [day, setDay] = useState(() => planDayOf(new Date()));
  const [loggingKey, setLoggingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listPlans(clientId);
      setPlans(list);
      setSelectedId((current) => (current && list.some((p) => p.id === current) ? current : list[0]?.id ?? null));
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const plan = plans.find((p) => p.id === selectedId) ?? null;
  const canEdit = !!plan && plan.created_by === user?.id;
  const todayIndex = planDayOf(new Date());

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (editing) {
    return (
      <MealPlanEditor
        clientId={clientId}
        recipes={recipes}
        plan={editing.plan}
        dailyCalories={dailyCalories}
        allergies={allergies}
        preferences={preferences}
        startGenerated={editing.generated}
        onCancel={() => setEditing(null)}
        onSaved={(saved) => {
          setPlans((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
          setSelectedId(saved.id);
          setEditing(null);
        }}
      />
    );
  }

  const remove = async () => {
    if (!plan || !window.confirm(t.plan.deleteConfirm)) return;
    try {
      await deletePlan(plan.id);
      showToast(t.plan.deleted, 'info');
      load();
    } catch (error) {
      console.error('Error deleting plan:', error);
      showToast(t.plan.saveError, 'error');
    }
  };

  const addWeekToShopping = async () => {
    if (!plan) return;
    // Cada receita entra uma vez, com a soma das porções da semana.
    const servingsByRecipe = new Map<string, number>();
    for (const item of plan.items) servingsByRecipe.set(item.recipe_id, (servingsByRecipe.get(item.recipe_id) ?? 0) + item.servings);
    const sources = [...servingsByRecipe.entries()]
      .map(([id, servings]) => {
        const recipe = byId.get(id);
        return recipe ? { title: recipe.title, ingredients: recipe.ingredients, factor: servings } : null;
      })
      .filter((s): s is NonNullable<typeof s> => !!s);
    try {
      const count = await useShoppingListStore.getState().addSources(sources);
      showToast(t.plan.shoppingAdded.replace('{count}', String(count)), 'success');
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      showToast(t.shopping.error, 'error');
    }
  };

  const logItem = async (recipeId: string, servings: number, key: string) => {
    const recipe = byId.get(recipeId);
    if (!recipe) return;
    setLoggingKey(key);
    try {
      await useNutritionTrackingStore.getState().addRecipeToLog(recipe, servings);
      showToast(t.plan.logged, 'success');
    } catch (error) {
      console.error('Error logging plan item:', error);
      showToast(t.profile.diaryError, 'error');
    } finally {
      setLoggingKey(null);
    }
  };

  const createButtons = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setEditing({ plan: null, generated: true })}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        <Sparkles className="h-4 w-4" />
        {t.plan.generate}
      </button>
      <button
        type="button"
        onClick={() => setEditing({ plan: null, generated: false })}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" />
        {mode === 'client' ? t.plan.create : t.plan.newPlan}
      </button>
    </div>
  );

  if (!plan) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
        <CalendarRange className="h-10 w-10 text-emerald-500" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{t.plan.empty}</p>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{t.plan.emptyHint}</p>
        </div>
        {createButtons}
      </div>
    );
  }

  const dayItems = plan.items.filter((i) => i.day === day);
  const dayKcal = dayItems.reduce((s, i) => s + (byId.get(i.recipe_id)?.nutritionFacts.calories ?? 0) * i.servings, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {plans.length > 1 ? (
            <select
              value={plan.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-base font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              aria-label={t.plan.choosePlan}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : (
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{plan.title}</h3>
          )}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {plan.created_by === user?.id ? t.plan.byYou : t.plan.byNutritionist.replace('{name}', plan.authorName ?? '')}
            {' • '}
            {t.plan.updated} {new Date(plan.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === 'client' && (
            <button
              type="button"
              onClick={addWeekToShopping}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <ShoppingCart className="h-4 w-4" />
              {t.plan.shoppingWeek}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing({ plan, generated: false })}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
              {t.plan.edit}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing({ plan: null, generated: false })}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            {t.plan.newPlan}
          </button>
          {(canEdit || mode === 'client') && (
            <button
              type="button"
              onClick={remove}
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
              aria-label={t.plan.delete}
              title={t.plan.delete}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {plan.notes && (
        <p className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
          {plan.notes}
        </p>
      )}

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {t.plan.days.map((label, d) => (
          <button
            key={label}
            type="button"
            onClick={() => setDay(d)}
            className={cn(
              'min-w-[56px] rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
              d === day
                ? 'border-emerald-500 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            )}
          >
            {d === todayIndex ? t.plan.today : label}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.plan.daysLong[day]}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t.plan.dayTotal}: <span className="font-semibold text-slate-900 dark:text-white">{Math.round(dayKcal)} kcal</span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {MEAL_SLOTS.map((meal) => {
          const mealItems = dayItems.filter((i) => i.meal === meal);
          return (
            <div key={meal} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.plan.meals[meal]}</p>
              {!mealItems.length && <p className="text-sm text-slate-400 dark:text-slate-500">{t.plan.emptyMeal}</p>}
              <div className="space-y-3">
                {mealItems.map((item, index) => {
                  const recipe = byId.get(item.recipe_id);
                  if (!recipe) return null;
                  const key = `${item.recipe_id}-${meal}-${index}`;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <Link to={`/receita/${recipe.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-90">
                        <img src={recipe.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg bg-slate-100 object-cover dark:bg-slate-800" loading="lazy" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{recipe.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.servings} {t.plan.servingsShort} • {Math.round(recipe.nutritionFacts.calories * item.servings)} kcal
                          </p>
                        </div>
                      </Link>
                      {mode === 'client' && day === todayIndex && (
                        <button
                          type="button"
                          onClick={() => logItem(recipe.id, item.servings, key)}
                          disabled={loggingKey === key}
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                        >
                          {loggingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
                          {t.plan.logToDiary}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
