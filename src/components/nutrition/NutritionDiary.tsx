import React, { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2, CalendarDays, Plus, XCircle, Loader2, Pencil, Check, X } from 'lucide-react';
import { WeeklyCaloriesChart } from './WeeklyCaloriesChart';
import {
  DIARY_MEALS,
  HISTORY_DAYS,
  mealForTime,
  toISODate,
  useNutritionTrackingStore,
  type DiaryMeal,
  type DiaryMealTarget,
  type NutritionLogEntry,
} from '../../store/nutrition-tracking';
import type { PlanMeal } from '../../services/care';
import { usePlanMealsOn } from '../../hooks/usePlanMealsOn';
import { useAuthStore } from '../../store/auth';
import { mealTimeOn } from '../../lib/plan-meals';
import { GOAL_KEYS, useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useRecipeIndex } from '../../hooks/useRecipeIndex';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { CommonFoodForm, CustomFoodForm, PhotoEstimateButton } from './DiaryFoodForms';
import type { PhotoEstimate } from '../../services/gemini';
import { cn } from '../../lib/utils';
import { fmtNum, appLocale } from '../../lib/format';
import { confirmDialog } from '../../store/confirm';
import { useCanUseAI } from '../../store/premium';
import { useToday } from '../../hooks/useToday';

type AddMode = 'recipe' | 'food' | 'custom';

/**
 * Escolha de refeição no diário, como texto (para chips e selects): 'plan:<id>' (bloco do plano),
 * 'slot:<categoria>' (refeições de sempre) ou 'off' (fora do plano / outros).
 */
type MealKey = string;
const OFF: MealKey = 'off';

/** Refeição sugerida pelo horário: o último bloco do plano cujo horário já passou; sem horários, pela categoria. */
function suggestedKey(planMeals: PlanMeal[] | null, day: number, now = new Date()): MealKey {
  if (!planMeals) return `slot:${mealForTime(now)}`;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const timed = planMeals
    .map((m) => ({ m, time: mealTimeOn(m, day) }))
    .filter((x): x is { m: PlanMeal; time: string } => Boolean(x.time))
    .map(({ m, time }) => ({ m, at: Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) }))
    .filter((x) => x.at <= minutes + 30)
    .sort((a, b) => b.at - a.at);
  if (timed.length) return `plan:${timed[0].m.id}`;
  const byCategory = planMeals.find((m) => m.category === mealForTime(now));
  return byCategory ? `plan:${byCategory.id}` : `plan:${planMeals[0].id}`;
}

const clampPct = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

function ProgressRow({
  label,
  value,
  goal,
  unit,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
}) {
  const pct = clampPct(goal > 0 ? value / goal : 0);
  // kcal sem casas decimais; gramas com no máximo uma ("33,5 g", "50 g").
  const fmt = (n: number) => n.toLocaleString(appLocale(), { maximumFractionDigits: unit === 'kcal' ? 0 : 1 });
  const display = `${fmt(value)} / ${fmt(goal)} ${unit}`;
  const barPct = Math.round(pct * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700 dark:text-slate-200">{label}</span>
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {display}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            pct <= 1 ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

export function NutritionDiary() {
  const t = useTranslation();
  const { recipes } = useRecipeIndex();
  const { showToast } = useToastStore();
  const { goals, activeGoals } = useNutritionGoalsStore();
  const { entries: allEntries, addRecipeToLog, updateEntry, removeEntry, clearDate, getTotalsForDate } =
    useNutritionTrackingStore();

  const today = useToday();
  const [date, setDate] = React.useState(today);
  // Virou o dia com o diário aberto em "hoje": vai para o novo dia (um dia passado escolhido fica).
  const [shownToday, setShownToday] = React.useState(today);
  if (shownToday !== today) {
    setShownToday(today);
    if (date === shownToday) setDate(today);
  }
  const [quickRecipeId, setQuickRecipeId] = React.useState('');
  // Texto livre: permite digitar "0,5" sem o campo pular para 1 no meio da digitação.
  const [servings, setServings] = React.useState('1');
  const [adding, setAdding] = React.useState(false);
  // Quase tudo que se registra é alimento avulso: começa nele.
  const [mode, setMode] = React.useState<AddMode>('food');
  // Refeição do que vai ser registrado: começa na do horário.
  // Com plano em uso na data: os blocos da prescrição daquele dia + "Fora do plano"; sem plano, as refeições de sempre.
  const userId = useAuthStore((s) => s.user?.id);
  const planMeals = usePlanMealsOn(userId, date);
  const planDay = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
  const [mealChoice, setMealChoice] = React.useState<MealKey | null>(null);
  // A escolha vale enquanto existir entre as opções da data; senão, a sugerida pelo horário.
  const choiceValid =
    mealChoice === OFF ||
    (mealChoice?.startsWith('slot:') && !planMeals) ||
    Boolean(planMeals?.some((m) => `plan:${m.id}` === mealChoice));
  const mealKey: MealKey = mealChoice && choiceValid ? mealChoice : planMeals || date === today ? suggestedKey(planMeals, planDay) : OFF;
  /** O destino gravado para uma escolha. */
  const targetOf = (key: MealKey): DiaryMealTarget => {
    if (key.startsWith('plan:')) {
      const m = planMeals?.find((x) => `plan:${x.id}` === key);
      return m ? { id: m.id, name: m.name, category: m.category } : null;
    }
    return key.startsWith('slot:') ? (key.slice(5) as DiaryMeal) : null;
  };
  const meal = targetOf(mealKey);
  // Registro em edição (porções e refeição).
  const [editing, setEditing] = React.useState<{ id: string; servings: string; meal: MealKey; fromPlan: boolean } | null>(null);
  // Estimativa por foto (Mentoria IA) preenche o formulário "Outro"; a chave remonta o formulário.
  const canUsePhoto = useCanUseAI();
  const [photo, setPhoto] = React.useState<{ key: number; estimate: PhotoEstimate } | null>(null);

  // Atalho "Registrar refeição" (?adicionar=1): leva direto ao formulário.
  const [searchParams] = useSearchParams();
  const addRef = useRef<HTMLDivElement>(null);
  const wantsAdd = searchParams.has('adicionar');
  useEffect(() => {
    if (wantsAdd) addRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [wantsAdd]);
  const isToday = date === today;

  const entries = useMemo(() => allEntries.filter((e) => e.date === date), [allEntries, date]);
  // `allEntries` força o recálculo quando o diário muda (o getter lê o estado direto).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totals = useMemo(() => getTotalsForDate(date), [getTotalsForDate, date, allEntries]);

  const availableRecipes = recipes.slice().sort((a, b) => a.title.localeCompare(b.title));

  const handleQuickAdd = async () => {
    const recipe = recipes.find((r) => r.id === quickRecipeId);
    if (!recipe) {
      showToast(t.profile.pickARecipe, 'warning');
      return;
    }
    const amount = parseFloat(servings.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast(t.profile.invalidServings, 'warning');
      return;
    }
    setAdding(true);
    try {
      await addRecipeToLog(recipe, amount, date, meal);
      showToast(t.profile.loggedToDiary, 'success');
      setQuickRecipeId('');
      setServings('1');
    } catch (error) {
      console.error('Error adding diary entry:', error);
      showToast(t.profile.diaryError, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleClearDay = async () => {
    if (!entries.length) return;
    if (!(await confirmDialog(t.profile.clearDiaryConfirm))) return;
    try {
      await clearDate(date);
      showToast(t.profile.diaryCleared, 'info');
    } catch (error) {
      console.error('Error clearing diary:', error);
      showToast(t.profile.diaryError, 'error');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const amount = parseFloat(editing.servings.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast(t.profile.invalidServings, 'warning');
      return;
    }
    try {
      await updateEntry(editing.id, { servings: amount, meal: editTarget(editing.meal) });
      setEditing(null);
      showToast(t.profileUi.entryUpdated, 'success');
    } catch (error) {
      console.error('Error updating diary entry:', error);
      showToast(t.profile.diaryError, 'error');
    }
  };

  // Chave de refeição de um registro: o bloco do plano, a refeição de sempre ou nenhuma.
  const entryKey = (e: NutritionLogEntry): MealKey => (e.mealId ? `plan:${e.mealId}` : e.meal ? `slot:${e.meal}` : OFF);

  // Registros do dia agrupados por refeição: blocos do plano na ordem prescrita, depois as refeições
  // de sempre e, por último, fora do plano / sem refeição. Nomes do plano aparecem como escritos.
  const groups = useMemo(() => {
    const order: { key: MealKey; label: string }[] = [
      ...(planMeals ?? []).map((m) => ({ key: `plan:${m.id}`, label: m.name })),
      ...DIARY_MEALS.map((m) => ({ key: `slot:${m}`, label: t.plan.meals[m] })),
    ];
    // Blocos de um plano anterior (ou de outro dia) que não estão na lista: pelo nome gravado.
    for (const e of entries) {
      if (e.mealId && !order.some((o) => o.key === `plan:${e.mealId}`)) order.push({ key: `plan:${e.mealId}`, label: e.mealName ?? t.profileUi.otherMeal });
    }
    order.push({ key: OFF, label: planMeals ? t.profileUi.offPlan : t.profileUi.otherMeal });
    return order.map((o) => ({ ...o, list: entries.filter((e) => entryKey(e) === o.key) })).filter((g) => g.list.length > 0);
  }, [entries, planMeals, t]);

  // Opções de refeição (chips ao registrar e select ao corrigir).
  const mealOptions: { key: MealKey; label: string }[] = planMeals
    ? [...planMeals.map((m) => ({ key: `plan:${m.id}`, label: m.name })), { key: OFF, label: t.profileUi.offPlan }]
    : [...DIARY_MEALS.map((m) => ({ key: `slot:${m}`, label: t.plan.meals[m] })), { key: OFF, label: t.profileUi.otherMeal }];
  const editTarget = (key: MealKey): DiaryMealTarget => {
    if (key.startsWith('plan:')) {
      const id = key.slice(5);
      const m = planMeals?.find((x) => x.id === id);
      if (m) return { id: m.id, name: m.name, category: m.category };
      const kept = entries.find((e) => e.mealId === id);
      return kept ? { id, name: kept.mealName ?? '', category: kept.meal } : null;
    }
    return key.startsWith('slot:') ? (key.slice(5) as DiaryMeal) : null;
  };

  const entryRow = (e: NutritionLogEntry) =>
    editing?.id === e.id ? (
      <div key={e.id} className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/10">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{e.recipeTitle}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            {t.profile.servings}
            <input
              type="number"
              min={0.1}
              step={0.1}
              inputMode="decimal"
              value={editing.servings}
              onChange={(ev) => setEditing({ ...editing, servings: ev.target.value })}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <select
            value={editing.meal}
            onChange={(ev) => setEditing({ ...editing, meal: ev.target.value })}
            className="max-w-[12rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
            aria-label={t.profileUi.mealLabel}
          >
            {[...mealOptions, ...(mealOptions.some((o) => o.key === editing.meal) ? [] : [{ key: editing.meal, label: groups.find((g) => g.key === editing.meal)?.label ?? '' }])].map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg p-2 text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-900"
              aria-label={t.common.cancel}
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={saveEdit}
              className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700"
              aria-label={t.common.save}
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Registro do "Comi": corrigir aqui desliga da marcação (marcar de novo não o sobrescreve). */}
        {editing.fromPlan && <p className="text-xs text-amber-700 dark:text-amber-300">{t.profileUi.planEntryHint}</p>}
      </div>
    ) : (
      <div
        key={e.id}
        className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{e.recipeTitle}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t.profile.servings}: <span className="font-medium">{fmtNum(e.servings)}</span> • {Math.round(e.perServing.calories * e.servings)} kcal
          </p>
        </div>
        <div className="flex shrink-0">
          <button
            type="button"
            onClick={() => setEditing({ id: e.id, servings: String(e.servings), meal: entryKey(e), fromPlan: Boolean(e.planCheckId) })}
            className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label={t.profileUi.editEntry}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleRemove(e.id)}
            className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label={t.profile.remove}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );

  const handleRemove = async (id: string) => {
    try {
      await removeEntry(id);
      showToast(t.profile.entryRemoved, 'info');
    } catch (error) {
      console.error('Error removing diary entry:', error);
      showToast(t.profile.diaryError, 'error');
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-500" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.profile.diaryTitle}
          </h3>
        </div>

        <input
          type="date"
          value={date}
          min={toISODate(new Date(Date.now() - HISTORY_DAYS * 86400000))}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label={t.profileUi.diaryDate}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      {/* Adicionar: receita do catálogo, alimento comum ou valores digitados */}
      <div ref={addRef} className="scroll-mt-20 space-y-3">
      {/* Em qual refeição entra o que for registrado agora. */}
      <div role="radiogroup" aria-label={t.profileUi.mealLabel} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {mealOptions.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={mealKey === o.key}
            onClick={() => setMealChoice(o.key)}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              mealKey === o.key
                ? 'border-emerald-500 bg-emerald-600 text-white'
                : 'border-slate-200 text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-300'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div role="tablist" className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {(['food', 'recipe', 'custom'] as AddMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              mode === m
                ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            )}
          >
            {m === 'recipe' ? t.foods.tabRecipe : m === 'food' ? t.foods.tabFood : canUsePhoto ? t.profileUi.typeOrPhoto : t.profileUi.typeIn}
          </button>
        ))}
      </div>
      {mode === 'food' && <CommonFoodForm date={date} meal={meal} />}
      {mode === 'custom' && (
        <div className="space-y-3">
          {canUsePhoto && (
            <PhotoEstimateButton onResult={(estimate) => setPhoto((prev) => ({ key: (prev?.key ?? 0) + 1, estimate }))} />
          )}
          <CustomFoodForm
            key={photo?.key ?? 0}
            date={date}
            meal={meal}
            initial={photo ? { name: `${photo.estimate.name} (${photo.estimate.portion})`, values: photo.estimate } : null}
          />
        </div>
      )}
      {mode === 'recipe' && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select
          value={quickRecipeId}
          onChange={(e) => setQuickRecipeId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">{t.profile.chooseRecipe}</option>
          {availableRecipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={0.1}
          step={0.1}
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder={t.profile.servings}
        />

        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={adding}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.profile.addToDiary}
        </button>
      </div>
      )}
      </div>

      {/* Progress */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isToday
              ? t.profile.todayProgress
              : t.profileUi.progressOn.replace('{date}', new Date(`${date}T12:00:00`).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' }))}
          </h4>
          {isToday && <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.todayResets}</p>}
        </div>

        {/* As mesmas metas do painel: só as escolhidas em "Metas para acompanhar" (nenhuma escolhida: todas). */}
        <div className="space-y-3">
          {(activeGoals.length ? GOAL_KEYS.filter((key) => activeGoals.includes(key)) : GOAL_KEYS).map((key) => (
            <ProgressRow key={key} label={t.profile.nutritionGoalsnames[key]} value={totals[key]} goal={goals[key]} unit={key === 'calories' ? 'kcal' : 'g'} />
          ))}
        </div>
      </div>

      <WeeklyCaloriesChart entries={allEntries} goal={goals.calories} selectedDate={date} onSelectDate={setDate} />

      {/* Entries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.profile.loggedMeals}
          </h4>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {entries.length} {t.profile.items}
          </span>
        </div>

        {!entries.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 text-slate-400" />
              <p>{t.profile.noDiaryEntries}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key} className="space-y-2">
                <div className="flex items-baseline justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {Math.round(g.list.reduce((sum, e) => sum + e.perServing.calories * e.servings, 0))} kcal
                  </p>
                </div>
                {g.list.map(entryRow)}
              </div>
            ))}
            {/* Apagar o dia inteiro é raro: fica no fim da lista, longe da data. */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleClearDay}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.profile.clearDay}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
