import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarRange, FileDown, ListChecks, Pencil, Plus, ShoppingCart, Sparkles, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useToastStore } from '../../store/toast';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useShoppingListStore } from '../../store/shopping-list';
import { useNotificationSignal } from '../../store/notifications';
import { useTranslation } from '../../hooks/useTranslation';
import { deletePlan, listPlans, MEAL_SLOTS, planDayOf, type MealPlan, type MealPlanItem } from '../../services/care';
import { itemsCalories, mealBlocks } from '../../lib/plan-items';
import { foodLogValues } from '../../lib/food-math';
import { PlanItemRow } from './PlanItemRow';
import { MealCheckBar } from './MealCheckBar';
import { dateForPlanDay, type CheckStatus, type MealCheck } from '../../lib/adherence';
import { deleteCheck, listChecks, saveCheck } from '../../services/adherence';
import { toISODate } from '../../store/nutrition-tracking';
import { listSwapsForClient, pendingFor, type SwapRequest } from '../../services/swaps';
import { SwapRequestDialog } from '../swaps/SwapRequestDialog';
import { SwapRequestsList } from '../swaps/SwapRequestsList';
import { MealPlanEditor } from './MealPlanEditor';
import { PlanPrintView } from './PlanPrintView';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '../../lib/utils';
import { fmtNum } from '../../lib/format';
import { confirmDialog } from '../../store/confirm';

interface PlansSectionProps {
  clientId: string;
  /** 'client': o próprio cliente; 'nutritionist': visto pelo nutricionista do paciente. */
  mode: 'client' | 'nutritionist';
  dailyCalories: number;
  allergies: string[];
  preferences: string[];
  /** Muda para recarregar os planos (ex.: depois de o nutricionista responder uma troca). */
  reloadKey?: number;
  /** Nome do paciente no PDF (no modo cliente usa o nome do próprio usuário). */
  patientName?: string;
}

export function PlansSection({ clientId, mode, dailyCalories, allergies, preferences, reloadKey = 0, patientName }: PlansSectionProps) {
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
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [swapsKey, setSwapsKey] = useState(0);
  const [swapping, setSwapping] = useState<{ item: MealPlanItem; label: string } | null>(null);
  const [checks, setChecks] = useState<MealCheck[]>([]);
  const [checkingMeal, setCheckingMeal] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const stopPrinting = useCallback(() => setPrinting(false), []);
  // O paciente recebe aviso quando o nutricionista muda o plano, responde uma troca ou encerra o
  // acompanhamento (os planos dele somem): recarrega na hora.
  const planSignal = useNotificationSignal((n) => mode === 'client' && (n.kind === 'plan_updated' || n.kind === 'swap_answered' || n.kind === 'link_ended'));

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
  }, [load, reloadKey, planSignal]);

  // Pedidos de troca do paciente: marcam os itens com pedido aberto.
  useEffect(() => {
    if (mode !== 'client') return;
    listSwapsForClient(clientId)
      .then(setSwaps)
      .catch((error) => console.error('Error loading swaps:', error));
  }, [clientId, mode, swapsKey, planSignal]);

  // Marcações de adesão da última semana (só o próprio paciente marca).
  useEffect(() => {
    if (mode !== 'client') return;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    listChecks(clientId, toISODate(since))
      .then(setChecks)
      .catch((error) => console.error('Error loading meal checks:', error));
  }, [clientId, mode, planSignal]);

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
    if (!plan || !(await confirmDialog(t.plan.deleteConfirm))) return;
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
    // Itens fixos + a 1ª opção de cada grupo (as opções são alternativas: compra-se uma delas).
    const counted = new Set<string>();
    const weekItems = plan.items.filter((item) => {
      if (item.option_group === null) return true;
      const key = `${item.day}-${item.meal}-${item.option_group}`;
      if (counted.has(key)) return false;
      counted.add(key);
      return true;
    });
    // Cada receita entra uma vez, com a soma das porções da semana; cada alimento, com a soma dos gramas.
    const servingsByRecipe = new Map<string, number>();
    const gramsByFood = new Map<string, { name: string; grams: number }>();
    for (const item of weekItems) {
      if (item.food_id && item.food && item.grams) {
        const current = gramsByFood.get(item.food_id);
        gramsByFood.set(item.food_id, { name: item.food.name, grams: (current?.grams ?? 0) + item.grams });
      } else if (item.recipe_id) {
        servingsByRecipe.set(item.recipe_id, (servingsByRecipe.get(item.recipe_id) ?? 0) + item.servings);
      }
    }
    const sources = [
      ...[...servingsByRecipe.entries()]
        .map(([id, servings]) => {
          const recipe = byId.get(id);
          return recipe ? { title: recipe.title, ingredients: recipe.ingredients, factor: servings } : null;
        })
        .filter((s): s is NonNullable<typeof s> => !!s),
      ...[...gramsByFood.values()].map(({ name, grams }) => ({
        title: name,
        ingredients: [`${Math.round(grams)} g de ${name}`],
        factor: 1,
      })),
    ];
    try {
      const count = await useShoppingListStore.getState().addSources(sources);
      showToast(t.plan.shoppingAdded.replace('{count}', String(count)), 'success');
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      showToast(t.shopping.error, 'error');
    }
  };

  /** Lança um item do plano no diário (de hoje ou da data informada). */
  const logToDiary = async (item: MealPlanItem, date?: string) => {
    const tracking = useNutritionTrackingStore.getState();
    if (item.food_id && item.food && item.grams) {
      // Alimento: entra com os nutrientes completos da quantidade prescrita.
      const { totals, extra } = foodLogValues(item.food, item.grams);
      await tracking.addFoodToLog(`${item.food.name} — ${item.measure_label ?? `${item.grams} g`}`, totals, 1, date, extra);
    } else {
      const recipe = item.recipe_id ? byId.get(item.recipe_id) : undefined;
      if (recipe) await tracking.addRecipeToLog(recipe, item.servings, date);
    }
  };

  const logItem = async (item: MealPlanItem, key: string) => {
    setLoggingKey(key);
    try {
      await logToDiary(item);
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
  // A data real do dia escolhido: hoje ou um dia passado desta semana (nunca futuro).
  const dayDate = dateForPlanDay(day);

  const itemName = (item: MealPlanItem) =>
    item.food_id ? item.food?.name ?? '' : (item.recipe_id && byId.get(item.recipe_id)?.title) || '';

  const saveMealCheck = async (meal: MealPlanItem['meal'], status: CheckStatus, eaten: MealPlanItem[], note: string) => {
    const previous = checks.find((c) => c.check_date === dayDate && c.meal === meal);
    setCheckingMeal(meal);
    try {
      const saved = await saveCheck({ clientId, planId: plan.id, date: dayDate, meal, status, chosen: eaten.map(itemName), note });
      setChecks((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)]);
      // "Comi" lança a refeição no diário daquele dia (só na primeira vez, para não duplicar).
      if (status === 'ate' && previous?.status !== 'ate') {
        for (const item of eaten) await logToDiary(item, dayDate);
        showToast(t.adherence.savedAte, 'success');
      } else {
        showToast(t.adherence.saved, 'success');
      }
    } catch (error) {
      console.error('Error saving meal check:', error);
      showToast(t.adherence.error, 'error');
    } finally {
      setCheckingMeal(null);
    }
  };

  const clearMealCheck = async (check: MealCheck) => {
    setCheckingMeal(check.meal);
    try {
      await deleteCheck(check.id);
      setChecks((prev) => prev.filter((c) => c.id !== check.id));
      if (check.status === 'ate') showToast(t.adherence.clearedAte, 'info');
    } catch (error) {
      console.error('Error clearing meal check:', error);
      showToast(t.adherence.error, 'error');
    } finally {
      setCheckingMeal(null);
    }
  };
  const dayKcal = itemsCalories(dayItems, byId);
  const dayHasOptions = dayItems.some((i) => i.option_group !== null);

  // O paciente pede troca só em planos feitos pelo nutricionista (no próprio plano ele edita direto).
  const canRequestSwap = mode === 'client' && plan.created_by !== user?.id;

  const itemLabel = (item: MealPlanItem) => {
    if (item.food_id) return `${item.food?.name ?? ''} — ${item.measure_label ?? `${item.grams} g`}`;
    const recipe = item.recipe_id ? byId.get(item.recipe_id) : undefined;
    return `${recipe?.title ?? ''} — ${fmtNum(item.servings)} ${t.plan.servingsShort}`;
  };

  const swapControl = (item: MealPlanItem) => {
    if (!canRequestSwap) return null;
    if (pendingFor(swaps, plan.id, item)) {
      return (
        <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {t.swaps.pendingBadge}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setSwapping({ item, label: itemLabel(item) })}
        className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label={t.swaps.swapButton}
        title={t.swaps.swapButton}
      >
        <ArrowLeftRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        <span className="hidden sm:inline">{t.swaps.swapButton}</span>
      </button>
    );
  };

  const itemActions = (item: MealPlanItem, key: string) => (
    <>
      {logButton(item, key)}
      {swapControl(item)}
    </>
  );

  const logButton = (item: MealPlanItem, key: string) =>
    mode === 'client' && day === todayIndex ? (
      <button
        type="button"
        onClick={() => logItem(item, key)}
        disabled={loggingKey === key}
        aria-label={t.plan.logToDiary}
        title={t.plan.logToDiary}
        className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
      >
        {loggingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
        {/* No celular só o ícone, para o nome do item não ficar espremido. */}
        <span className="hidden sm:inline">{t.plan.logToDiary}</span>
      </button>
    ) : null;

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
          <button
            type="button"
            onClick={() => setPrinting(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            title={t.plan.pdfTitle}
          >
            <FileDown className="h-4 w-4" />
            {t.plan.pdf}
          </button>
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
      {dayHasOptions && <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">{t.plan.firstOptionNote}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {MEAL_SLOTS.map((meal) => {
          const mealItems = dayItems.filter((i) => i.meal === meal);
          return (
            <div key={meal} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.plan.meals[meal]}</p>
              {!mealItems.length && <p className="text-sm text-slate-400 dark:text-slate-500">{t.plan.emptyMeal}</p>}
              <div className="space-y-3">
                {mealBlocks(mealItems).map((block, blockIndex) => {
                  if (block.kind === 'single') {
                    const key = `${meal}-${blockIndex}`;
                    return <PlanItemRow key={key} item={block.item} recipesById={byId} actions={itemActions(block.item, key)} />;
                  }
                  // Lista de substituição: o paciente escolhe uma das opções e registra a que comeu.
                  return (
                    <div key={`${meal}-g${block.group}`} className="space-y-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 dark:border-amber-700/50 dark:bg-amber-900/10">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        <ListChecks className="h-3.5 w-3.5" />
                        {t.plan.chooseOne}
                      </p>
                      {block.items.map((item, index) => {
                        const key = `${meal}-g${block.group}-${index}`;
                        return (
                          <div key={key}>
                            {index > 0 && <p className="pb-1 text-center text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">{t.plan.or}</p>}
                            <PlanItemRow item={item} recipesById={byId} actions={itemActions(item, key)} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              {mode === 'client' && mealItems.length > 0 && (
                <MealCheckBar
                  key={`${dayDate}-${meal}`}
                  items={mealItems}
                  check={checks.find((c) => c.check_date === dayDate && c.meal === meal)}
                  busy={checkingMeal === meal}
                  itemName={itemName}
                  onSave={(status, eaten, note) => saveMealCheck(meal, status, eaten, note)}
                  onClear={() => {
                    const current = checks.find((c) => c.check_date === dayDate && c.meal === meal);
                    if (current) clearMealCheck(current);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {mode === 'client' && <SwapRequestsList clientId={clientId} role="client" refreshKey={swapsKey} onCanceled={() => setSwapsKey((k) => k + 1)} />}

      {printing && (
        <PlanPrintView
          plan={plan}
          recipesById={byId}
          patientName={patientName ?? (mode === 'client' ? user?.name ?? '' : '')}
          onDone={stopPrinting}
        />
      )}

      {swapping && (
        <SwapRequestDialog
          planId={plan.id}
          item={swapping.item}
          itemLabel={swapping.label}
          onClose={() => setSwapping(null)}
          onSent={() => {
            setSwapping(null);
            setSwapsKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
