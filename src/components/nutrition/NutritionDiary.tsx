import React, { useMemo } from 'react';
import { Trash2, CalendarDays, Plus, XCircle } from 'lucide-react';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useRecipesStore } from '../../store/recipes';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';

const toISODate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  const display = `${value.toFixed(1)} / ${goal.toFixed(1)} ${unit}`;
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
  const { recipes } = useRecipesStore();
  const { showToast } = useToastStore();
  const { goals } = useNutritionGoalsStore();
  const { entries: allEntries, addRecipeToLog, removeEntry, clearDate, getEntriesForDate, getTotalsForDate } =
    useNutritionTrackingStore();

  const [date, setDate] = React.useState(() => toISODate(new Date()));
  const [quickRecipeId, setQuickRecipeId] = React.useState<number | ''>('');
  const [servings, setServings] = React.useState(1);

  const entries = useMemo(() => getEntriesForDate(date), [getEntriesForDate, date, allEntries]);
  const totals = useMemo(() => getTotalsForDate(date), [getTotalsForDate, date, allEntries]);

  const availableRecipes = recipes.slice().sort((a, b) => a.title.localeCompare(b.title));

  const handleQuickAdd = () => {
    const id = Number(quickRecipeId);
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) {
      showToast(t.profile.pickARecipe ?? 'Selecione uma receita.', 'warning');
      return;
    }
    addRecipeToLog(recipe, servings, date);
    showToast(t.profile.loggedToDiary ?? 'Adicionado ao diário.', 'success');
  };

  const handleClearDay = () => {
    if (!entries.length) return;
    const ok = window.confirm(t.profile.clearDiaryConfirm ?? 'Limpar o diário deste dia?');
    if (!ok) return;
    clearDate(date);
    showToast(t.profile.diaryCleared ?? 'Diário limpo.', 'info');
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-500" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.profile.diaryTitle ?? 'Diário alimentar'}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleClearDay}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <Trash2 className="h-4 w-4" />
            {t.profile.clearDay ?? 'Limpar'}
          </button>
        </div>
      </div>

      {/* Quick add */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select
          value={quickRecipeId}
          onChange={(e) => setQuickRecipeId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">{t.profile.chooseRecipe ?? 'Escolher receita...'}</option>
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
          onChange={(e) => setServings(Math.max(0.1, Number(e.target.value) || 1))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder={t.profile.servings ?? 'Porções'}
        />

        <button
          type="button"
          onClick={handleQuickAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t.profile.addToDiary ?? 'Adicionar'}
        </button>
      </div>

      {/* Progress */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t.profile.todayProgress ?? 'Progresso do dia'}
        </h4>

        <div className="space-y-3">
          <ProgressRow label={t.profile.nutritionGoalsnames.calories} value={totals.calories} goal={goals.calories} unit="kcal" />
          <ProgressRow label={t.profile.nutritionGoalsnames.protein} value={totals.protein} goal={goals.protein} unit="g" />
          <ProgressRow label={t.profile.nutritionGoalsnames.carbs} value={totals.carbs} goal={goals.carbs} unit="g" />
          <ProgressRow label={t.profile.nutritionGoalsnames.fat} value={totals.fat} goal={goals.fat} unit="g" />
          <ProgressRow label={t.profile.nutritionGoalsnames.fiber} value={totals.fiber} goal={goals.fiber} unit="g" />
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.profile.loggedMeals ?? 'Registros'}
          </h4>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {entries.length} {t.profile.items ?? 'itens'}
          </span>
        </div>

        {!entries.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 text-slate-400" />
              <p>{t.profile.noDiaryEntries ?? 'Nenhum item registrado neste dia.'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {e.recipeTitle}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t.profile.servings ?? 'Porções'}: <span className="font-medium">{e.servings}</span> • {e.perServing.calories.toFixed(0)} kcal/{t.profile.perServing ?? 'porção'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    removeEntry(e.id);
                    showToast(t.profile.entryRemoved ?? 'Item removido.', 'info');
                  }}
                  className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-white hover:text-rose-600 dark:text-slate-300 dark:hover:bg-slate-900"
                  aria-label={t.profile.remove ?? 'Remover'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
