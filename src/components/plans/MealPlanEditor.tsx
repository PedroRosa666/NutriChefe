import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Bot, Carrot, Crown, LayoutTemplate, ListChecks, Loader2, Scale, Sparkles, Trash2, Save, X } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { MEAL_SLOTS, planDayOf, savePlan, type MealPlan, type MealPlanItem, type MealSlot } from '../../services/care';
import { generateWeeklyPlan } from '../../lib/meal-plan-generator';
import { isItemAvailable, itemsCalories, mealBlocks, nextOptionGroup, scaleItemsToTarget } from '../../lib/plan-items';
import { FoodQuantityPicker, type PickedFood } from '../foods/FoodQuantityPicker';
import { EquivalentFoods } from '../foods/EquivalentFoods';
import { PlanItemRow } from './PlanItemRow';
import { PlanTemplatesPanel } from './PlanTemplatesPanel';
import { cn } from '../../lib/utils';
import { useOwnPremium, usePremiumStore } from '../../store/premium';
import { useFoodsStore } from '../../store/foods';
import { generatePlanWithAI } from '../../services/gemini';
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

/** Painel de inclusão aberto numa refeição: receita ou alimento, solto ou dentro de um grupo de opções. */
interface Adder {
  meal: MealSlot;
  kind: 'recipe' | 'food';
  group: number | null;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const chipClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-emerald-300';

const emptyItem = (day: number, meal: MealSlot, group: number | null): Omit<MealPlanItem, 'recipe_id' | 'food_id'> => ({
  day,
  meal,
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
  const [adder, setAdder] = useState<Adder | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const navigate = useNavigate();
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
      const result = await generatePlanWithAI(clientId, aiNotes.trim(), dailyCalories);
      // Os alimentos vêm só com o id: o catálogo precisa estar carregado para mostrar nome e nutrientes.
      await useFoodsStore.getState().fetch();
      const foodsById = new Map(useFoodsStore.getState().foods.map((f) => [f.id, f]));
      setItems(
        result.items.map((i) => ({
          ...i,
          food: i.food_id ? foodsById.get(i.food_id) ?? null : null,
          measure_label: null,
          option_group: null,
        }))
      );
      setAiSummary(result.summary);
      setAiOpen(false);
      showToast(t.plan.aiDone, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message && !error.message.includes('_') ? error.message : t.plan.aiError, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const sortedRecipes = useMemo(() => recipes.slice().sort((a, b) => a.title.localeCompare(b.title)), [recipes]);
  const hasOptions = items.some((i) => i.option_group !== null);

  const dayCalories = (d: number) => itemsCalories(items.filter((i) => i.day === d), byId);

  /** Média de calorias dos dias que têm itens. */
  const averageDayCalories = (list: MealPlanItem[]) => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => itemsCalories(list.filter((i) => i.day === d), byId)).filter((k) => k > 0);
    return days.length ? Math.round(days.reduce((sum, k) => sum + k, 0) / days.length) : 0;
  };

  const regenerate = () => {
    const next = generate();
    if (!next.length) {
      showToast(t.plan.generateEmpty, 'warning');
      return;
    }
    // O gerador só monta receitas; alimentos e grupos de opções do dia ficam como estavam.
    setItems((prev) => [...prev.filter((i) => i.food_id || i.option_group !== null), ...next]);
    showToast(t.plan.generated, 'success');
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

  const applyTemplate = (input: { items: MealPlanItem[]; title: string; notes: string }) => {
    setItems(input.items);
    setTitle((current) => current || input.title);
    setNotes((current) => current || input.notes);
    setAdder(null);
    setShowTemplates(false);
  };

  const addRecipe = (target: Adder, recipeId: string) => {
    if (!recipeId) return;
    setItems((prev) => [...prev, { ...emptyItem(day, target.meal, target.group), recipe_id: recipeId, food_id: null }]);
    // Fora de um grupo, fecha; dentro, fica aberto para a próxima opção.
    if (target.group === null) setAdder(null);
  };

  const addFood = (target: Adder, picked: PickedFood) => {
    setItems((prev) => [
      ...prev,
      {
        ...emptyItem(day, target.meal, target.group),
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

  const removeGroup = (meal: MealSlot, group: number) =>
    setItems((prev) => prev.filter((i) => !(i.day === day && i.meal === meal && i.option_group === group)));

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
        items: items.filter((i) => isItemAvailable(i, byId)),
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
        <select value="" onChange={(e) => addRecipe(target, e.target.value)} className={cn(inputClass, 'dark:[color-scheme:dark]')}>
          <option value="">{t.plan.addRecipe}</option>
          {sortedRecipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} ({Math.round(r.nutritionFacts.calories)} kcal)
            </option>
          ))}
        </select>
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            aria-expanded={showTemplates}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold',
              showTemplates
                ? 'border-sky-400 bg-sky-600 text-white'
                : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800/50 dark:bg-sky-900/20 dark:text-sky-300'
            )}
          >
            <LayoutTemplate className="h-4 w-4" />
            {t.plan.templatesButton}
          </button>
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
          <button
            type="button"
            onClick={regenerate}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            <Sparkles className="h-4 w-4" />
            {items.length ? t.plan.regenerate : t.plan.generate}
          </button>
          {aiAllowed && (
            <button
              type="button"
              onClick={() => (aiUnlocked ? setAiOpen((v) => !v) : navigate('/mentoria-ia'))}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {aiUnlocked ? <Bot className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
              {t.plan.aiBuild}
            </button>
          )}
        </div>
      </div>

      {aiOpen && (
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

      {showTemplates && <PlanTemplatesPanel items={items} title={title} notes={notes} onApply={applyTemplate} />}

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MEAL_SLOTS.map((meal) => {
          const mealItems = items.filter((i) => i.day === day && i.meal === meal);
          const isOpen = (group: number | null) => adder?.meal === meal && adder.group === group;
          return (
            <div key={meal} className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.plan.meals[meal]}</p>

              {mealBlocks(mealItems).map((block) =>
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
                        onClick={() => removeGroup(meal, block.group)}
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
                    ) : (
                      <button type="button" onClick={() => setAdder({ meal, kind: 'food', group: block.group })} className={chipClass}>
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
                          onPick={(picked) => addFood({ meal, kind: 'food', group: block.group }, picked)}
                        />
                      );
                    })()}
                  </div>
                )
              )}

              {isOpen(null) && adderPanel(adder!)}
              {/* Novo grupo de opções: o painel abre já ligado ao próximo número de grupo. */}
              {adder?.meal === meal && adder.group !== null && !mealItems.some((i) => i.option_group === adder.group) && (
                <div className="space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2 dark:border-amber-700/50 dark:bg-amber-900/10">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <ListChecks className="h-3.5 w-3.5" />
                    {t.plan.chooseOne}
                  </p>
                  {adderPanel(adder)}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button type="button" onClick={() => setAdder({ meal, kind: 'recipe', group: null })} className={chipClass}>
                  <BookOpen className="h-3.5 w-3.5" />
                  {t.plan.addRecipeButton}
                </button>
                <button type="button" onClick={() => setAdder({ meal, kind: 'food', group: null })} className={chipClass}>
                  <Carrot className="h-3.5 w-3.5" />
                  {t.plan.addFoodButton}
                </button>
                <button type="button" onClick={() => setAdder({ meal, kind: 'food', group: nextOptionGroup(mealItems) })} className={chipClass}>
                  <ListChecks className="h-3.5 w-3.5" />
                  {t.plan.addOptionsButton}
                </button>
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
