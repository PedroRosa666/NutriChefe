import { useEffect, useMemo, useState } from 'react';
import { Apple, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useFoodsStore } from '../../store/foods';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { searchFoods } from '../../lib/food-math';
import type { Food, FoodInput, FoodMeasure } from '../../services/foods';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../store/settings';
import { EXTRA_NUTRIENTS, cleanExtraNutrients, type ExtraNutrientKey } from '../../lib/nutrients';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300';

type NutrientKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sodium';
const NUTRIENTS: NutrientKey[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium'];

interface Draft {
  id: string | null;
  name: string;
  category: string;
  values: Record<NutrientKey, string>;
  extra: Partial<Record<ExtraNutrientKey, string>>;
  measures: { label: string; grams: string }[];
}

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  category: '',
  values: { kcal: '', protein: '', carbs: '', fat: '', fiber: '', sodium: '' },
  extra: {},
  measures: [],
});

const draftFrom = (food: Food, asCopy: boolean): Draft => ({
  id: asCopy ? null : food.id,
  name: food.name,
  category: food.category,
  values: {
    kcal: String(food.kcal),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    fiber: String(food.fiber),
    sodium: food.sodium === null ? '' : String(food.sodium),
  },
  extra: Object.fromEntries(Object.entries(food.nutrients).map(([k, v]) => [k, String(v)])),
  measures: food.measures.map((m) => ({ label: m.label, grams: String(m.grams) })),
});

const toNumber = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Alimentos próprios do nutricionista: visíveis só para ele e para os pacientes que acompanha. */
export function MyFoodsPanel() {
  const t = useTranslation();
  const f = t.myFoods;
  const user = useAuthStore((s) => s.user);
  const language = useSettingsStore((s) => s.language);
  const { showToast } = useToastStore();
  const { foods, loaded, fetch, create, update, remove } = useFoodsStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseQuery, setBaseQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch().catch((error) => {
      console.error('Error loading foods:', error);
      showToast(t.foods.catalogError, 'error');
    });
  }, [fetch, showToast, t.foods.catalogError]);

  const mine = useMemo(() => foods.filter((food) => food.owner_id === user?.id), [foods, user?.id]);
  const categories = useMemo(() => [...new Set(foods.filter((food) => food.taco_id).map((food) => food.category))].sort(), [foods]);
  const baseMatches = useMemo(
    () => (baseQuery.trim() ? searchFoods(foods.filter((food) => food.taco_id), baseQuery, 6) : []),
    [foods, baseQuery],
  );

  const save = async () => {
    if (!draft || !user) return;
    const values = Object.fromEntries(NUTRIENTS.map((k) => [k, toNumber(draft.values[k])])) as Record<NutrientKey, number | null>;
    const measures: FoodMeasure[] = draft.measures
      .map((m) => ({ label: m.label.trim(), grams: toNumber(m.grams) ?? 0 }))
      .filter((m) => m.label && m.grams > 0);
    if (draft.name.trim().length < 2 || values.kcal === null) {
      showToast(f.invalid, 'warning');
      return;
    }
    const input: FoodInput = {
      name: draft.name.trim(),
      category: draft.category.trim() || f.defaultCategory,
      kcal: values.kcal,
      protein: values.protein ?? 0,
      carbs: values.carbs ?? 0,
      fat: values.fat ?? 0,
      fiber: values.fiber ?? 0,
      sodium: values.sodium,
      // Campos vazios ficam fora: "não informado", não zero.
      nutrients: cleanExtraNutrients(
        Object.fromEntries(Object.entries(draft.extra).map(([k, v]) => [k, v ? toNumber(v) : null])),
      ),
      measures,
    };
    setSaving(true);
    try {
      if (draft.id) await update(draft.id, input);
      else await create(user.id, input);
      showToast(f.saved, 'success');
      setDraft(null);
    } catch (error) {
      console.error('Error saving food:', error);
      showToast(f.saveError, 'error');
    } finally {
      setSaving(false);
    }
  };

  const erase = async (food: Food) => {
    if (!window.confirm(f.confirmDelete.replace('{name}', food.name))) return;
    try {
      await remove(food.id);
      showToast(f.deleted, 'success');
    } catch (error) {
      console.error('Error deleting food:', error);
      // 23503: o alimento está em algum plano alimentar (chave estrangeira com RESTRICT).
      const inUse = (error as { code?: string } | null)?.code === '23503';
      showToast(inUse ? f.inUse : f.saveError, 'error');
    }
  };

  const setValue = (key: NutrientKey, value: string) =>
    setDraft((d) => (d ? { ...d, values: { ...d.values, [key]: value } } : d));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Apple className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {f.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{f.subtitle}</p>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={() => {
              setDraft(emptyDraft());
              setBaseQuery('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {f.new}
          </button>
        )}
      </div>

      {draft && (
        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5 dark:border-emerald-800/40 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">{draft.id ? f.edit : f.new}</h3>
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t.common.close}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {!draft.id && (
            <div className="space-y-2">
              <label className={labelClass} htmlFor="food-base">{f.startFrom}</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input id="food-base" value={baseQuery} onChange={(e) => setBaseQuery(e.target.value)} placeholder={f.startFromPlaceholder} className={cn(inputClass, 'pl-9')} />
              </div>
              {baseMatches.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {baseMatches.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => {
                        setDraft(draftFrom(food, true));
                        setBaseQuery('');
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-200"
                    >
                      {food.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="food-name">{f.name}</label>
              <input id="food-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={f.namePlaceholder} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="food-category">{f.category}</label>
              <input id="food-category" list="food-categories" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder={f.defaultCategory} className={inputClass} />
              <datalist id="food-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div>
            <p className={labelClass}>{f.per100g}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {NUTRIENTS.map((key) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400" htmlFor={`food-${key}`}>{f.nutrients[key]}</label>
                  <input id={`food-${key}`} type="number" inputMode="decimal" min={0} step="0.1" value={draft.values[key]} onChange={(e) => setValue(key, e.target.value)} className={inputClass} />
                </div>
              ))}
            </div>
          </div>

          <details className="rounded-lg border border-slate-200 dark:border-slate-700">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">{f.moreNutrients}</summary>
            <div className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-3">
              {EXTRA_NUTRIENTS.map((info) => (
                <div key={info.key}>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400" htmlFor={`food-x-${info.key}`}>
                    {language === 'pt' ? info.pt : info.en} ({info.unit})
                  </label>
                  <input
                    id={`food-x-${info.key}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={draft.extra[info.key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, extra: { ...draft.extra, [info.key]: e.target.value } })}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </details>

          <div className="space-y-2">
            <p className={labelClass}>{f.measures}</p>
            {draft.measures.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={m.label}
                  onChange={(e) => setDraft({ ...draft, measures: draft.measures.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                  placeholder={f.measureLabel}
                  aria-label={f.measureLabel}
                  className={cn(inputClass, 'min-w-0 flex-1')}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={m.grams}
                  onChange={(e) => setDraft({ ...draft, measures: draft.measures.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)) })}
                  placeholder="g"
                  aria-label={f.measureGrams}
                  className={cn(inputClass, 'w-20')}
                />
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, measures: draft.measures.filter((_, j) => j !== i) })}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                  aria-label={f.removeMeasure}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDraft({ ...draft, measures: [...draft.measures, { label: '', grams: '' }] })}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              <Plus className="h-4 w-4" />
              {f.addMeasure}
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {f.save}
            </button>
          </div>
        </section>
      )}

      {!loaded ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
        </div>
      ) : !mine.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {f.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {mine.map((food) => (
            <li key={food.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{food.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {food.category} • {Math.round(food.kcal)} kcal {t.foods.per100g}
                  {food.measures.length > 0 && ` • ${food.measures.map((m) => m.label).join(', ')}`}
                </p>
              </div>
              <button type="button" onClick={() => setDraft(draftFrom(food, false))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label={f.edit}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => erase(food)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20" aria-label={f.delete}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400">{f.privacy}</p>
    </div>
  );
}
