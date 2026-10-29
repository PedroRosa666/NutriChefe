import { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Minus, Plus, X } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useFoodsStore } from '../../store/foods';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { searchFoods } from '../../lib/food-math';
import { RECIPE_LIMITS, emptyIngredient, parseAmount, suggestGrams, type LineIssue } from '../../lib/recipe-nutrition';
import { parseIngredient } from '../../lib/ingredients';
import { cn } from '../../lib/utils';
import type { Food } from '../../services/foods';
import type { RecipeIngredient } from '../../types/recipe';

interface RecipeIngredientsFieldProps {
  rows: RecipeIngredient[];
  onChange: (rows: RecipeIngredient[]) => void;
  inputClass: string;
  /** Valores calculados pelos ingredientes: mostra o que falta em cada linha. */
  calc?: boolean;
  /** Pendência de cada linha no cálculo (pelo índice). */
  issues?: Map<number, LineIssue>;
}

/**
 * Ingredientes da receita: cada linha é texto livre (nada impede salvar porque o catálogo não tem o
 * ingrediente), com alimento do catálogo e observação opcionais.
 */
export function RecipeIngredientsField({ rows, onChange, inputClass, calc, issues }: RecipeIngredientsFieldProps) {
  const t = useTranslation();
  const f = t.recipeForm;
  const [linking, setLinking] = useState<number | null>(null);
  const { foods, fetch } = useFoodsStore();
  const foodsById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const anyLinked = rows.some((r) => r.foodId);

  // Medidas caseiras e valores dos alimentos ligados vêm do catálogo.
  useEffect(() => {
    if (anyLinked || calc) fetch().catch((error) => console.error('Error loading foods:', error));
  }, [anyLinked, calc, fetch]);

  const update = (index: number, patch: Partial<RecipeIngredient>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  // Texto mudou numa linha ligada: refaz os gramas quando dá para ler ("200 g", medida do alimento).
  const changeText = (index: number, text: string) => {
    const row = rows[index];
    const food = row.foodId ? foodsById.get(row.foodId) : undefined;
    const suggested = food ? suggestGrams(text, food) : null;
    update(index, suggested ? { text, grams: suggested.grams, measureLabel: suggested.measureLabel } : { text });
  };

  const changeMeasure = (index: number, label: string) => {
    const row = rows[index];
    const food = row.foodId ? foodsById.get(row.foodId) : undefined;
    const measure = food?.measures.find((m) => m.label === label);
    if (!measure) return update(index, { measureLabel: null });
    const qty = parseIngredient(row.text).quantity ?? 1;
    update(index, { measureLabel: measure.label, grams: Math.round(qty * measure.grams * 10) / 10 });
  };

  const changeGrams = (index: number, value: string) => {
    const n = parseAmount(value);
    update(index, { grams: n !== null && Number.isFinite(n) && n > 0 ? n : null, measureLabel: null });
  };
  const remove = (index: number) => {
    setLinking(null);
    onChange(rows.filter((_, i) => i !== index));
  };
  const add = () => onChange([...rows, emptyIngredient()]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{f.ingredientsHint}</p>
      {rows.map((row, index) => (
        <div key={row.id ?? `new-${index}`} className="space-y-1.5 rounded-xl border border-slate-200/80 bg-white/60 p-2 dark:border-slate-700/80 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              {index + 1}
            </span>
            <input
              type="text"
              value={row.text}
              maxLength={RECIPE_LIMITS.ingredientText}
              onChange={(e) => changeText(index, e.target.value)}
              className={cn(inputClass, 'flex-1')}
              placeholder={t.recipe.example}
              aria-label={`${t.recipe.ingredients} ${index + 1}`}
              required
            />
            <button
              type="button"
              onClick={() => setLinking(linking === index ? null : index)}
              aria-label={f.linkFood}
              title={f.linkFood}
              aria-expanded={linking === index}
              className={cn(
                'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border shadow-sm transition',
                row.foodId
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'border-slate-200 bg-white/80 text-slate-400 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900/70'
              )}
            >
              <Link2 className="h-4 w-4" />
            </button>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={t.common.remove}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-9">
            {row.foodId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                {f.linkedFood.replace('{name}', row.foodName ?? '…')}
                <button
                  type="button"
                  onClick={() => update(index, { foodId: null, foodName: null, grams: null, measureLabel: null })}
                  aria-label={f.unlinkFood}
                  className="rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-800/40"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {row.foodId && (
              <GramsInput
                key={`${row.foodId}-${row.grams ?? ''}`}
                grams={row.grams ?? null}
                label={`${f.grams} ${index + 1}`}
                onCommit={(value) => changeGrams(index, value)}
              />
            )}
            {row.foodId && (foodsById.get(row.foodId)?.measures.length ?? 0) > 0 && (
              <select
                value={row.measureLabel ?? ''}
                onChange={(e) => changeMeasure(index, e.target.value)}
                aria-label={`${f.measure} ${index + 1}`}
                className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">{f.gramsOnly}</option>
                {foodsById.get(row.foodId)!.measures.map((m) => (
                  <option key={m.label} value={m.label}>
                    {m.label} ({m.grams} g)
                  </option>
                ))}
              </select>
            )}
            {calc && (
              <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={!!row.excluded} onChange={(e) => update(index, { excluded: e.target.checked })} className="h-3.5 w-3.5 accent-emerald-600" />
                {f.excluded}
              </label>
            )}
            <input
              type="text"
              value={row.note}
              maxLength={RECIPE_LIMITS.ingredientNote}
              onChange={(e) => update(index, { note: e.target.value })}
              placeholder={f.notePlaceholder}
              aria-label={`${f.notePlaceholder} ${index + 1}`}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-600 outline-none focus:border-slate-200 focus:bg-white dark:text-slate-300 dark:focus:border-slate-700 dark:focus:bg-slate-900"
            />
          </div>
          {calc && issues?.has(index) && !row.excluded && (
            <p className="pl-9 text-xs text-amber-700 dark:text-amber-300">
              {(issues.get(index) === 'no_food' ? f.issueNoFood : f.issueNoGrams).replace('{n}', String(index + 1))}
            </p>
          )}
          {linking === index && (
            <FoodLinkPicker
              initialQuery={row.text}
              inputClass={inputClass}
              onPick={(food) => {
                const text = row.text.trim() ? row.text : food.name;
                const suggested = suggestGrams(text, food);
                update(index, {
                  foodId: food.id,
                  foodName: food.name,
                  text,
                  grams: suggested?.grams ?? null,
                  measureLabel: suggested?.measureLabel ?? null,
                });
                setLinking(null);
              }}
              onClose={() => setLinking(null)}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={rows.length >= RECIPE_LIMITS.ingredients}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
      >
        <Plus className="h-3.5 w-3.5" />
        {t.recipe.addIngredient}
      </button>
      {rows.length >= RECIPE_LIMITS.ingredients && <p className="text-xs text-amber-700 dark:text-amber-300">{f.tooManyIngredients}</p>}
    </div>
  );
}

/** Gramas da linha: aceita "1,5" e "1/2"; grava ao sair do campo. */
function GramsInput({ grams, label, onCommit }: { grams: number | null; label: string; onCommit: (value: string) => void }) {
  const [value, setValue] = useState(grams === null ? '' : String(grams).replace('.', ','));
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onCommit(value)}
        aria-label={label}
        placeholder="—"
        className="w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-900"
      />
      g
    </span>
  );
}

interface FoodLinkPickerProps {
  initialQuery: string;
  inputClass: string;
  onPick: (food: Food) => void;
  onClose: () => void;
}

/** Busca na TACO e nos alimentos próprios do autor (os únicos que a receita pode usar). */
function FoodLinkPicker({ initialQuery, inputClass, onPick, onClose }: FoodLinkPickerProps) {
  const t = useTranslation();
  const f = t.recipeForm;
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const { foods, loaded, fetch, create } = useFoodsStore();
  const [query, setQuery] = useState(initialQuery.replace(/^[\d\s.,/½⅓⅔¼¾]+(g|kg|ml|l)?\s*(de\s+)?/i, ''));
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch().catch((error) => {
      console.error('Error loading foods:', error);
      showToast(t.foods.catalogError, 'error');
    });
  }, [fetch, showToast, t.foods.catalogError]);

  // Alimento de outro profissional (visível a um paciente) não pode entrar na receita.
  const allowed = useMemo(() => foods.filter((food) => food.owner_id === null || food.owner_id === user?.id), [foods, user?.id]);
  const matches = useMemo(() => (query.trim() ? searchFoods(allowed, query, 8) : []), [allowed, query]);

  const createOwn = async () => {
    const value = parseFloat(kcal.replace(',', '.'));
    if (!user || name.trim().length < 2 || !Number.isFinite(value) || value < 0 || value > 950) {
      showToast(f.ownFoodInvalid, 'warning');
      return;
    }
    setSaving(true);
    try {
      const food = await create(user.id, {
        name: name.trim(),
        category: t.myFoods.defaultCategory,
        kcal: value,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sodium: null,
        nutrients: {},
        measures: [],
      });
      showToast(f.ownFoodSaved, 'success');
      onPick(food);
    } catch (error) {
      console.error('Error creating food:', error);
      showToast(t.myFoods.saveError, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={f.searchFood}
          aria-label={f.searchFood}
          className={cn(inputClass, 'flex-1 py-2 text-sm')}
        />
        <button type="button" onClick={onClose} aria-label={t.common.close} className="rounded-lg p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>
      </div>
      {!loaded ? (
        <Loader2 className="mx-auto h-4 w-4 animate-spin text-emerald-600" />
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {matches.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => onPick(food)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white dark:hover:bg-slate-800"
              >
                <span className="text-slate-800 dark:text-slate-100">{food.name}</span>
                <span className="flex-shrink-0 text-xs text-slate-500">{Math.round(food.kcal)} kcal/100 g</span>
              </button>
            </li>
          ))}
          {query.trim() && !matches.length && <li className="px-2 py-1 text-xs text-slate-500">{f.noFoodFound}</li>}
        </ul>
      )}
      {user?.type === 'Nutritionist' &&
        (creating ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-emerald-200 pt-2 dark:border-emerald-900">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={f.ownFoodName} aria-label={f.ownFoodName} className={cn(inputClass, 'min-w-0 flex-[2] py-2 text-sm')} />
            <input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" placeholder={f.ownFoodKcal} aria-label={f.ownFoodKcal} className={cn(inputClass, 'w-32 flex-1 py-2 text-sm')} />
            <button
              type="button"
              onClick={createOwn}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t.common.save}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setName(query.trim());
              setCreating(true);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            {f.createOwnFood}
          </button>
        ))}
    </div>
  );
}
