import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Bot, Carrot, ChevronDown, Crown, LayoutTemplate, ListChecks, Loader2, Plus, Scale, Search, Send, Sparkles, Trash2, Save, X } from 'lucide-react';
import { confirmDialog } from '../../store/confirm';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { planDayOf, type MealPlan, type MealPlanItem, type PlanMeal } from '../../services/care';
import { newOperationId, savePlanDraft } from '../../services/plans';
import { errorCode, errorText } from '../../lib/app-errors';
import { appLocale } from '../../lib/format';
import { toISODate } from '../../store/nutrition-tracking';
import { generateWeeklyPlanDetailed } from '../../lib/meal-plan-generator';
import { isItemAvailable, itemsCalories, mealBlocks, nextOptionGroup, scaleItemsToTarget } from '../../lib/plan-items';
import { ALL_DAYS, MEAL_LIMITS, dayShares, defaultMeals, definedShareSum, mealItems, mealTimeOn, mealsOnDay, newMealId } from '../../lib/plan-meals';
import { MealBlockHeader } from './MealBlockHeader';
import { FoodQuantityPicker, type PickedFood } from '../foods/FoodQuantityPicker';
import { EquivalentFoods } from '../foods/EquivalentFoods';
import { PlanItemRow } from './PlanItemRow';
import { PlanTemplatesPanel } from './PlanTemplatesPanel';
import { cn } from '../../lib/utils';
import { useOwnPremium, usePremiumStore } from '../../store/premium';
import { useFoodsStore } from '../../store/foods';
import { generatePlanWithAI } from '../../services/gemini';
import type { Recipe } from '../../types/recipe';
import { matchesSearch } from '../../lib/search';

interface MealPlanEditorProps {
  clientId: string;
  recipes: Recipe[];
  plan?: MealPlan | null;
  dailyCalories: number;
  allergies: string[];
  preferences: string[];
  /** Abre já com um cardápio gerado. */
  startGenerated?: boolean;
  /** Salvou (e talvez publicou): id do plano. */
  onSaved: (planId: string) => void;
  onCancel: () => void;
  /** Avisa quando há alterações não salvas (para o voltar do celular pedir confirmação). */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Painel de inclusão aberto numa refeição: receita ou alimento, solto ou dentro de um grupo de opções. */
interface Adder {
  mealId: string;
  kind: 'recipe' | 'food';
  group: number | null;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const chipClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-emerald-300';

const emptyItem = (day: number, mealId: string, group: number | null): Omit<MealPlanItem, 'recipe_id' | 'food_id'> => ({
  day,
  meal_id: mealId,
  servings: 1,
  grams: null,
  measure_label: null,
  option_group: group,
  note: '',
});

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
  onDirtyChange,
}: MealPlanEditorProps) {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();

  // Plano novo começa com as quatro refeições de sempre; o profissional adiciona, renomeia e remove.
  const [meals, setMeals] = useState<PlanMeal[]>(() => plan?.meals ?? defaultMeals(t.plan.meals));
  const generate = () => generateWeeklyPlanDetailed({ recipes, dailyCalories, allergies, preferences, meals });

  const [title, setTitle] = useState(plan?.title ?? '');
  const [notes, setNotes] = useState(plan?.notes ?? '');
  const [items, setItems] = useState<MealPlanItem[]>(() => plan?.items ?? (startGenerated ? generate().items : []));
  const [day, setDay] = useState(() => planDayOf(new Date()));
  const [adder, setAdder] = useState<Adder | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState('');
  // Menu "Preencher plano": fecha ao tocar fora.
  const [fillOpen, setFillOpen] = useState(false);
  const fillMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fillOpen) return;
    const close = (e: MouseEvent) => {
      if (!fillMenuRef.current?.contains(e.target as Node)) setFillOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [fillOpen]);

  // Alterações não salvas: comparadas com o que abriu (um plano gerado na abertura já conta como mudança).
  const initial = useRef(JSON.stringify({ title: plan?.title ?? '', notes: plan?.notes ?? '', meals, items: plan?.items ?? [] }));
  const dirty = JSON.stringify({ title, notes, meals, items }) !== initial.current;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  // Fechar ou recarregar a aba com alterações: o navegador pergunta antes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const cancel = async () => {
    if (dirty && !(await confirmDialog(t.plan.discardConfirm))) return;
    onCancel();
  };
  const nutritionistPro = usePremiumStore((s) => s.nutritionistPro);
  const ownPremium = useOwnPremium();
  // IA: o nutricionista no plano de um paciente (Premium Nutricionista) ou o cliente no próprio plano (Premium).
  const ownPlan = clientId === user?.id;
  const aiAllowed = user?.type === 'Nutritionist' ? !ownPlan : ownPlan;
  const aiUnlocked = ownPlan ? ownPremium : nutritionistPro;
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const runAI = async () => {
    setAiLoading(true);
    try {
      const result = await generatePlanWithAI(clientId, aiNotes.trim(), dailyCalories, meals);
      // Os alimentos vêm só com o id: o catálogo precisa estar carregado para mostrar nome e nutrientes.
      await useFoodsStore.getState().fetch();
      const foodsById = new Map(useFoodsStore.getState().foods.map((f) => [f.id, f]));
      const next = result.items.map((i) => ({
        ...i,
        food: i.food_id ? foodsById.get(i.food_id) ?? null : null,
        measure_label: null,
        option_group: null,
      }));
      setItems(next);
      setAiSummary(result.summary);
      setAiOpen(false);
      // Refeição que a IA deixou vazia ou itens fora das refeições do plano: avisa, nunca esconde.
      const gaps = meals.flatMap((m) =>
        m.days.filter((d) => !next.some((i) => i.meal_id === m.id && i.day === d)).map((d) => `${m.name} (${t.plan.days[d]})`)
      );
      if (result.dropped) showToast(t.plan.aiDropped.replace('{count}', String(result.dropped)), 'warning');
      else if (gaps.length) showToast(t.plan.aiGaps.replace('{meals}', gaps.slice(0, 6).join(', ') + (gaps.length > 6 ? '…' : '')), 'warning');
      else showToast(t.plan.aiDone, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message && !error.message.includes('_') ? error.message : t.plan.aiError, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const sortedRecipes = useMemo(() => recipes.slice().sort((a, b) => a.title.localeCompare(b.title)), [recipes]);
  const hasOptions = items.some((i) => i.option_group !== null);
  // Sem busca: as receitas do próprio nutricionista primeiro; com busca, por nome.
  const matchingRecipes = useMemo(() => {
    const q = recipeQuery.trim();
    const list = q
      ? sortedRecipes.filter((r) => matchesSearch(q, r.title, r.category))
      : sortedRecipes.slice().sort((a, b) => Number(b.authorId === user?.id) - Number(a.authorId === user?.id));
    return list.slice(0, 30);
  }, [recipeQuery, sortedRecipes, user?.id]);

  const dayCalories = (d: number) => itemsCalories(items.filter((i) => i.day === d), byId);
  const dayMeals = mealsOnDay(meals, day);
  // Sugestão de % por refeição (mostrada quando o bloco não tem a sua) e a soma das % definidas.
  const { shares: suggestedShares } = dayShares(meals.map((m) => ({ ...m, kcalShare: null })), day);
  const shareSum = definedShareSum(meals, day);
  const shareOff = shareSum !== null && Math.abs(shareSum - 100) >= 0.5;
  // Nomes repetidos no dia são permitidos ("Lanche" duas vezes); sem horário, sugere diferenciar.
  const repeatedName = dayMeals.find((m, i) =>
    dayMeals.some((o, j) => j !== i && o.name.trim() === m.name.trim() && !mealTimeOn(o, day) && !mealTimeOn(m, day))
  );

  /** Média de calorias dos dias que têm itens. */
  const averageDayCalories = (list: MealPlanItem[]) => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => itemsCalories(list.filter((i) => i.day === d), byId)).filter((k) => k > 0);
    return days.length ? Math.round(days.reduce((sum, k) => sum + k, 0) / days.length) : 0;
  };

  const regenerate = async () => {
    // Gerar de novo troca todas as receitas: com o plano já montado, confirma antes.
    if (items.some((i) => i.recipe_id && i.option_group === null) && !(await confirmDialog(t.plan.regenerateConfirm))) return;
    const { items: next, relaxed, suggestedShares: suggested, offTarget } = generate();
    if (!next.length) {
      showToast(t.plan.generateEmpty, 'warning');
      return;
    }
    // O gerador só monta receitas; alimentos e grupos de opções do dia ficam como estavam.
    setItems((prev) => [...prev.filter((i) => i.food_id || i.option_group !== null), ...next]);
    // Preferência deixada de lado ou meta que não fechou: avisa em vez de ignorar calado.
    if (relaxed.length) {
      const names = relaxed.map((p) => t.health.diets[p as keyof typeof t.health.diets] ?? p).join(', ');
      showToast(t.plan.generatedRelaxed.replace('{prefs}', names), 'warning');
    } else if (offTarget.length) {
      showToast(
        t.plan.generatedOffTarget
          .replace('{days}', offTarget.map((o) => `${t.plan.days[o.day]} (${o.kcal} kcal)`).join(', '))
          .replace('{kcal}', String(offTarget[0].target)),
        'warning'
      );
    } else {
      showToast(suggested ? t.plan.generatedSuggested : t.plan.generated, 'success');
    }
  };

  // Muda as quantidades de cada dia na mesma proporção para chegar perto da meta do paciente.
  const scaleToGoal = () => {
    if (!items.length || !dailyCalories) return;
    const next = scaleItemsToTarget(items, dailyCalories, byId);
    const goal = String(Math.round(dailyCalories));
    const before = averageDayCalories(items);
    const after = averageDayCalories(next);
    const changed = next.some((item, i) => item.servings !== items[i].servings || item.grams !== items[i].grams);
    if (!changed) {
      // Porções vão de meia em meia: perto da meta, o ajuste não muda nada.
      showToast(t.plan.scaleNoChange.replace('{avg}', String(before)).replace('{kcal}', goal), 'info');
      return;
    }
    setItems(next);
    showToast(t.plan.scaled.replace('{before}', String(before)).replace('{after}', String(after)).replace('{kcal}', goal), 'success');
  };

  const applyTemplate = async (input: { meals: PlanMeal[]; items: MealPlanItem[]; title: string; notes: string }) => {
    if (items.length && !(await confirmDialog(t.plan.templateReplaceConfirm))) return;
    setMeals(input.meals);
    setItems(input.items);
    setTitle((current) => current || input.title);
    setNotes((current) => current || input.notes);
    setAdder(null);
    setShowTemplates(false);
  };

  const addRecipe = (target: Adder, recipeId: string) => {
    if (!recipeId) return;
    setItems((prev) => [...prev, { ...emptyItem(day, target.mealId, target.group), recipe_id: recipeId, food_id: null }]);
    // Fora de um grupo, fecha; dentro, fica aberto para a próxima opção.
    if (target.group === null) setAdder(null);
  };

  const addFood = (target: Adder, picked: PickedFood) => {
    setItems((prev) => [
      ...prev,
      {
        ...emptyItem(day, target.mealId, target.group),
        recipe_id: null,
        food_id: picked.food.id,
        food: picked.food,
        grams: picked.grams,
        measure_label: picked.label,
      },
    ]);
    if (target.group === null) setAdder(null);
  };

  const updateItem = (target: MealPlanItem, patch: Partial<MealPlanItem>) =>
    setItems((prev) => prev.map((i) => (i === target ? { ...i, ...patch } : i)));

  const removeItem = (target: MealPlanItem) => setItems((prev) => prev.filter((i) => i !== target));

  const removeGroup = (mealId: string, group: number) =>
    setItems((prev) => prev.filter((i) => !(i.day === day && i.meal_id === mealId && i.option_group === group)));

  // ------------------------------------------------------------ blocos de refeição
  const countOn = (list: PlanMeal[], d: number) => mealsOnDay(list, d).length;
  const updateMeal = (id: string, patch: Partial<PlanMeal>) => setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const limitToast = () => showToast(t.plan.mealLimitDay.replace('{n}', String(MEAL_LIMITS.mealsPerDay)), 'warning');

  const addMeal = () => {
    if (countOn(meals, day) >= MEAL_LIMITS.mealsPerDay || meals.length >= MEAL_LIMITS.mealsPerPlan) {
      limitToast();
      return;
    }
    // Entra nos dias que ainda têm espaço (sempre no dia aberto).
    const days = ALL_DAYS.filter((d) => d === day || countOn(meals, d) < MEAL_LIMITS.mealsPerDay);
    setMeals((prev) => [
      ...prev,
      { id: newMealId(), name: t.plan.newMealName, category: null, days, time: null, guidance: '', dayOverrides: {}, kcalShare: null },
    ]);
  };

  const toggleMealDay = async (meal: PlanMeal, d: number) => {
    if (meal.days.includes(d)) {
      const lost = mealItems(items, meal.id, d).length;
      const question = t.plan.mealDayOffConfirm.replace('{name}', meal.name).replace('{day}', t.plan.daysLong[d]).replace('{count}', String(lost));
      if (lost && !(await confirmDialog(question))) return;
      setItems((prev) => prev.filter((i) => !(i.meal_id === meal.id && i.day === d)));
      updateMeal(meal.id, { days: meal.days.filter((x) => x !== d) });
      return;
    }
    if (countOn(meals, d) >= MEAL_LIMITS.mealsPerDay) {
      limitToast();
      return;
    }
    updateMeal(meal.id, { days: [...meal.days, d].sort((a, b) => a - b) });
  };

  // Sobe ou desce entre as refeições do dia aberto (troca de lugar com a vizinha na ordem do plano).
  const moveMeal = (meal: PlanMeal, direction: -1 | 1) => {
    const neighbor = dayMeals[dayMeals.indexOf(meal) + direction];
    if (!neighbor) return;
    setMeals((prev) => {
      const next = prev.slice();
      const a = next.findIndex((m) => m.id === meal.id);
      const b = next.findIndex((m) => m.id === neighbor.id);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  // Cópia com id novo e itens novos (marcações, trocas e diário do original não vêm junto).
  const duplicateMeal = (meal: PlanMeal) => {
    if (meal.days.some((d) => countOn(meals, d) >= MEAL_LIMITS.mealsPerDay) || meals.length >= MEAL_LIMITS.mealsPerPlan) {
      limitToast();
      return;
    }
    const copy: PlanMeal = {
      ...meal,
      id: newMealId(),
      name: t.plan.copyName.replace('{name}', meal.name).slice(0, MEAL_LIMITS.name),
      days: [...meal.days],
      dayOverrides: { ...meal.dayOverrides },
    };
    setMeals((prev) => {
      const next = prev.slice();
      next.splice(next.findIndex((m) => m.id === meal.id) + 1, 0, copy);
      return next;
    });
    setItems((prev) => [...prev, ...prev.filter((i) => i.meal_id === meal.id).map((i) => ({ ...i, id: undefined, meal_id: copy.id }))]);
  };

  const removeMeal = async (meal: PlanMeal) => {
    const count = items.filter((i) => i.meal_id === meal.id).length;
    if (count && !(await confirmDialog(t.plan.removeMealConfirm.replace('{name}', meal.name).replace('{count}', String(count))))) return;
    setItems((prev) => prev.filter((i) => i.meal_id !== meal.id));
    setMeals((prev) => prev.filter((m) => m.id !== meal.id));
    if (adder?.mealId === meal.id) setAdder(null);
  };

  // O próprio plano do paciente (ownPlan) vale assim que salvo; o do nutricionista pode ficar em rascunho.
  // Tentativa em andamento: se a internet cair, salvar de novo o mesmo conteúdo reaproveita o id
  // (o banco devolve o resultado da 1ª vez em vez de gravar duas).
  const pendingSave = useRef<{ op: string; payload: string } | null>(null);

  const save = async (publish: boolean) => {
    if (!user || saving) return;
    setSaving(true);
    const payload = { title: title || t.plan.title, notes, meals, items: items.filter((i) => isItemAvailable(i, byId)), publish };
    const key = JSON.stringify(payload);
    const op = pendingSave.current?.payload === key ? pendingSave.current.op : newOperationId();
    pendingSave.current = { op, payload: key };
    try {
      const result = await savePlanDraft({
        id: plan?.id,
        clientId,
        title: payload.title,
        notes,
        meals,
        items: payload.items,
        expectedRevision: plan?.revision,
        publish,
        operationId: op,
      });
      pendingSave.current = null;
      const v = result.version;
      const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(appLocale(), { day: '2-digit', month: '2-digit' });
      showToast(
        !v
          ? t.plan.draftSaved
          : v.validFrom > toISODate(new Date())
            ? t.plan.publishedFrom.replace('{date}', shortDate(v.validFrom))
            : ownPlan
              ? t.plan.saved
              : t.plan.publishedToday,
        'success'
      );
      initial.current = JSON.stringify({ title, notes, meals, items });
      onDirtyChange?.(false);
      onSaved(result.planId);
    } catch (error) {
      console.error('Error saving plan:', error);
      // Só a falha de conexão pode ser repetida com o mesmo id; o resto pede um envio novo.
      if (errorCode(error) !== 'temporarily_unavailable') pendingSave.current = null;
      showToast(errorCode(error) === 'unknown' ? t.plan.saveError : errorText(error, t.appErrors), 'error');
    } finally {
      setSaving(false);
    }
  };

  const itemActions = (item: MealPlanItem) => (
    <>
      {!item.food_id && (
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
      )}
      <button
        type="button"
        onClick={() => removeItem(item)}
        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
        aria-label={t.profile.remove}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );

  const adderPanel = (target: Adder) => (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-800/40 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold dark:bg-slate-800">
          {(['recipe', 'food'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setAdder({ ...target, kind })}
              className={cn(
                'rounded-md px-2.5 py-1',
                target.kind === kind ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {kind === 'recipe' ? t.plan.addRecipeButton : t.plan.addFoodButton}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAdder(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t.plan.closeAdder}>
          <X className="h-4 w-4" />
        </button>
      </div>
      {target.kind === 'recipe' ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={recipeQuery}
              onChange={(e) => setRecipeQuery(e.target.value)}
              placeholder={t.plan.searchRecipe}
              className={cn(inputClass, 'pl-9')}
            />
          </div>
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {matchingRecipes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    addRecipe(target, r.id);
                    setRecipeQuery('');
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <span className="min-w-0 truncate text-slate-800 dark:text-slate-100">{r.title}</span>
                  <span className="flex-shrink-0 text-xs text-slate-500 dark:text-slate-400">{Math.round(r.nutritionFacts.calories)} kcal</span>
                </button>
              </li>
            ))}
            {!matchingRecipes.length && <li className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{t.plan.noRecipeFound}</li>}
          </ul>
        </div>
      ) : (
        <FoodQuantityPicker confirmLabel={target.group === null ? t.plan.addToMeal : t.plan.addAsOption} onConfirm={(picked) => addFood(target, picked)} />
      )}
    </div>
  );

  return (
    <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          {hasOptions && ` ${t.plan.firstOptionNote}`}
        </p>
        {/* Um menu para as três formas de preencher o plano; "Ajustar à meta" fica à parte (não troca itens). */}
        <div className="flex flex-wrap gap-2">
          <div className="relative" ref={fillMenuRef}>
            <button
              type="button"
              onClick={() => setFillOpen((v) => !v)}
              aria-expanded={fillOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Sparkles className="h-4 w-4" />
              {t.plan.fillMenu}
              <ChevronDown className={cn('h-4 w-4 transition-transform', fillOpen && 'rotate-180')} />
            </button>
            {fillOpen && (
              <div
                role="menu"
                className="absolute left-0 z-20 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:left-auto sm:right-0"
              >
                {[
                  {
                    key: 'template',
                    icon: LayoutTemplate,
                    label: t.plan.templatesButton,
                    hint: t.plan.fillTemplateHint,
                    onClick: () => setShowTemplates(true),
                  },
                  {
                    key: 'auto',
                    icon: Sparkles,
                    label: items.length ? t.plan.regenerate : t.plan.generate,
                    hint: t.plan.fillAutoHint,
                    onClick: regenerate,
                  },
                  ...(aiAllowed
                    ? [
                        {
                          key: 'ai',
                          icon: aiUnlocked ? Bot : Crown,
                          label: t.plan.aiBuild,
                          hint: aiUnlocked ? t.plan.fillAiHint : t.plan.fillAiLockedHint,
                          onClick: () => setAiOpen(true),
                        },
                      ]
                    : []),
                ].map(({ key, icon: Icon, label, hint, onClick }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setFillOpen(false);
                      onClick();
                    }}
                    className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-emerald-50 dark:border-slate-800 dark:hover:bg-emerald-900/20"
                  >
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={scaleToGoal}
            disabled={!items.length || !dailyCalories}
            title={t.plan.scaleHint}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Scale className="h-4 w-4" />
            {t.plan.scaleToGoal}
          </button>
        </div>
      </div>

      {aiOpen && !aiUnlocked && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
          <Crown className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1">{ownPlan ? t.plan.aiLockedClient : t.plan.aiLockedNutritionist}</p>
          {/* Nova aba: o plano em edição continua aqui. */}
          <Link to="/mentoria-ia" target="_blank" className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-400">
            {t.clientPremium.seePremium}
          </Link>
        </div>
      )}

      {aiOpen && aiUnlocked && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/10">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {ownPlan ? t.clientPremium.aiOwnNotesLabel : t.plan.aiNotesLabel}
            <textarea
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={t.plan.aiNotesPlaceholder}
              className={cn(inputClass, 'mt-1')}
            />
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ownPlan ? t.clientPremium.aiOwnHint : t.plan.aiHint}</p>
          <button
            type="button"
            onClick={runAI}
            disabled={aiLoading}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {aiLoading ? t.plan.aiLoading : t.plan.aiRun}
          </button>
        </div>
      )}

      {aiSummary && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Bot className="mr-1.5 inline h-4 w-4 text-emerald-600" />
          {aiSummary}
        </p>
      )}

      {showTemplates && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowTemplates(false)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
              {t.plan.closeTemplates}
            </button>
          </div>
          <PlanTemplatesPanel meals={meals} items={items} title={title} notes={notes} onApply={applyTemplate} />
        </div>
      )}

      {/* Dias da semana com o total de calorias de cada um */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {t.plan.days.map((label, d) => {
          const kcal = Math.round(dayCalories(d));
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                setDay(d);
                setAdder(null);
              }}
              className={cn(
                'flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors',
                d === day
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
              )}
            >
              <span className="font-semibold">{label}</span>
              <span className={cn('text-xs', d === day ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400')}>
                {kcal ? `${kcal} kcal` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {(shareOff || repeatedName) && (
        <div className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
          {shareOff && <p>{t.plan.mealShareSum.replace('{day}', t.plan.daysLong[day]).replace('{n}', String(shareSum))}</p>}
          {repeatedName && <p>{t.plan.sameNameHint.replace('{name}', repeatedName.name)}</p>}
        </div>
      )}

      {!dayMeals.length && (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{t.plan.noMealsDay}</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {dayMeals.map((meal, mealIndex) => {
          const mealId = meal.id;
          const blockItems = mealItems(items, mealId, day);
          const full = blockItems.length >= MEAL_LIMITS.itemsPerMeal;
          const isOpen = (group: number | null) => adder?.mealId === mealId && adder.group === group;
          return (
            <div key={mealId} className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <MealBlockHeader
                meal={meal}
                day={day}
                canMoveUp={mealIndex > 0}
                canMoveDown={mealIndex < dayMeals.length - 1}
                suggestedShare={suggestedShares.get(mealId) ?? null}
                onChange={(patch) => updateMeal(mealId, patch)}
                onToggleDay={(d) => toggleMealDay(meal, d)}
                onMove={(direction) => moveMeal(meal, direction)}
                onDuplicate={() => duplicateMeal(meal)}
                onRemove={() => removeMeal(meal)}
              />

              {mealBlocks(blockItems).map((block) =>
                block.kind === 'single' ? (
                  <div key={items.indexOf(block.item)} className="rounded-lg bg-white p-2 dark:bg-slate-900">
                    <PlanItemRow item={block.item} recipesById={byId} compact actions={itemActions(block.item)} />
                  </div>
                ) : (
                  <div key={`g${block.group}`} className="space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2 dark:border-amber-700/50 dark:bg-amber-900/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        <ListChecks className="h-3.5 w-3.5" />
                        {t.plan.chooseOne}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeGroup(mealId, block.group)}
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                        aria-label={t.plan.removeGroup}
                        title={t.plan.removeGroup}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {block.items.map((item, index) => (
                      <div key={items.indexOf(item)}>
                        {index > 0 && <p className="py-0.5 text-center text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">{t.plan.or}</p>}
                        <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                          <PlanItemRow item={item} recipesById={byId} compact actions={itemActions(item)} />
                        </div>
                      </div>
                    ))}
                    {isOpen(block.group) ? (
                      adderPanel(adder!)
                    ) : full ? null : (
                      <button type="button" onClick={() => setAdder({ mealId, kind: 'food', group: block.group })} className={chipClass}>
                        <ListChecks className="h-3.5 w-3.5" />
                        {t.plan.addOption}
                      </button>
                    )}
                    {/* Lista de substituição pronta: equivalentes da 1ª opção que for alimento. */}
                    {(() => {
                      const baseItem = block.items.find((i) => i.food && i.grams);
                      if (!baseItem?.food || !baseItem.grams) return null;
                      return (
                        <EquivalentFoods
                          key={`${baseItem.food.id}-${baseItem.grams}`}
                          base={baseItem.food}
                          grams={baseItem.grams}
                          exclude={block.items.flatMap((i) => (i.food_id ? [i.food_id] : []))}
                          pickLabel={t.plan.addAsOption}
                          onPick={(picked) => addFood({ mealId, kind: 'food', group: block.group }, picked)}
                        />
                      );
                    })()}
                  </div>
                )
              )}

              {isOpen(null) && adderPanel(adder!)}
              {/* Novo grupo de opções: o painel abre já ligado ao próximo número de grupo. */}
              {adder?.mealId === mealId && adder.group !== null && !blockItems.some((i) => i.option_group === adder.group) && (
                <div className="space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2 dark:border-amber-700/50 dark:bg-amber-900/10">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <ListChecks className="h-3.5 w-3.5" />
                    {t.plan.chooseOne}
                  </p>
                  {adderPanel(adder)}
                </div>
              )}

              {/* Limite de itens por refeição (o "Comi" leva todos ao diário): não deixa passar. */}
              {full ? (
                <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">{t.plan.mealFull.replace('{n}', String(MEAL_LIMITS.itemsPerMeal))}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button type="button" onClick={() => setAdder({ mealId, kind: 'recipe', group: null })} className={chipClass}>
                    <BookOpen className="h-3.5 w-3.5" />
                    {t.plan.addRecipeButton}
                  </button>
                  <button type="button" onClick={() => setAdder({ mealId, kind: 'food', group: null })} className={chipClass}>
                    <Carrot className="h-3.5 w-3.5" />
                    {t.plan.addFoodButton}
                  </button>
                  <button type="button" onClick={() => setAdder({ mealId, kind: 'food', group: nextOptionGroup(blockItems) })} className={chipClass}>
                    <ListChecks className="h-3.5 w-3.5" />
                    {t.plan.addOptionsButton}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addMeal}
        disabled={dayMeals.length >= MEAL_LIMITS.mealsPerDay}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
      >
        <Plus className="h-4 w-4" />
        {dayMeals.length >= MEAL_LIMITS.mealsPerDay ? t.plan.mealLimitDay.replace('{n}', String(MEAL_LIMITS.mealsPerDay)) : t.plan.addMeal}
      </button>


      <div className="sticky bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5 md:bottom-0 dark:border-slate-800 dark:bg-slate-900/95">
        {dirty && <span className="mr-auto text-xs font-medium text-amber-600 dark:text-amber-400">{t.plan.unsaved}</span>}
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t.plan.cancel}
        </button>
        {/* Nutricionista: rascunho (o paciente ainda não vê) ou salvar e publicar. Plano próprio: vale ao salvar. */}
        {!ownPlan && (
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{t.plan.saveDraft}</span>
            <span className="sm:hidden">{t.plan.draftShort}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : ownPlan ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {ownPlan ? t.plan.save : t.plan.saveAndPublish}
        </button>
      </div>
    </div>
  );
}
