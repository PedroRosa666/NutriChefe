import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useFoodsStore } from '../../store/foods';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { nutrientsFor, quantityLabel, searchFoods } from '../../lib/food-math';
import type { Food, PickedFood } from '../../services/foods';
import { NutritionFactsTable } from './NutritionFactsTable';
import { cn } from '../../lib/utils';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

const parseAmount = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type { PickedFood };

interface FoodQuantityPickerProps {
  confirmLabel: string;
  onConfirm: (picked: PickedFood) => Promise<void> | void;
}

/** Busca no catálogo (TACO + alimentos do nutricionista), escolhe a quantidade e confirma. */
export function FoodQuantityPicker({ confirmLabel, onConfirm }: FoodQuantityPickerProps) {
  const t = useTranslation();
  const { showToast } = useToastStore();
  const { foods, loaded, fetch } = useFoodsStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  // Índice da medida caseira escolhida; -1 = gramas.
  const [measureIndex, setMeasureIndex] = useState(-1);
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  useEffect(() => {
    fetch().catch((error) => {
      console.error('Error loading foods:', error);
      showToast(t.foods.catalogError, 'error');
    });
  }, [fetch, showToast, t.foods.catalogError]);

  // Só sugere depois que a pessoa digita: a lista inteira tem centenas de alimentos.
  const matches = useMemo(() => (query.trim() ? searchFoods(foods, query, 12) : []), [foods, query]);

  const choose = (food: Food) => {
    setSelected(food);
    // Com medida caseira começa em "1 unidade"; sem ela, em 100 g.
    setMeasureIndex(food.measures.length ? 0 : -1);
    setAmount(food.measures.length ? '1' : '100');
  };

  const measure = selected && measureIndex >= 0 ? selected.measures[measureIndex] ?? null : null;
  const parsed = parseAmount(amount);
  const grams = parsed ? (measure ? parsed * measure.grams : parsed) : 0;
  const preview = selected && grams ? nutrientsFor(selected, grams) : null;

  const confirm = async () => {
    if (!selected || !parsed || !grams) {
      showToast(t.profile.invalidServings, 'warning');
      return;
    }
    setBusy(true);
    try {
      await onConfirm({ food: selected, grams: Math.round(grams * 10) / 10, label: quantityLabel(parsed, measure) });
      setSelected(null);
      setQuery('');
      setShowFacts(false);
    } catch {
      // Quem chama já mostrou o erro; a seleção fica para tentar de novo.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.foods.search} className={inputClass} />
      {!loaded ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t.foods.loadingCatalog}
        </div>
      ) : (
        <div className="grid grid-cols-1 max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {!matches.length && query.trim() && <p className="py-3 text-sm text-slate-500 dark:text-slate-400">{t.foods.noResults}</p>}
          {matches.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => choose(f)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                selected?.id === f.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-200 hover:border-emerald-300 dark:border-slate-700'
              )}
            >
              <span className="block font-medium text-slate-900 dark:text-white">{f.name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {f.owner_id && <span className="font-semibold text-emerald-700 dark:text-emerald-400">{t.foods.fromNutritionist} • </span>}
                {Math.round(f.kcal)} kcal {t.foods.per100g}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{selected.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={measure ? 0.5 : 10}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={t.foods.quantity}
              className={cn(inputClass, 'w-24')}
            />
            <select
              value={measureIndex}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMeasureIndex(next);
                setAmount(next >= 0 ? '1' : '100');
              }}
              aria-label={t.foods.unit}
              className={cn(inputClass, 'w-auto min-w-0 flex-1')}
            >
              {selected.measures.map((m, i) => (
                <option key={m.label} value={i}>
                  {m.label} ({m.grams} g)
                </option>
              ))}
              <option value={-1}>{t.foods.grams}</option>
            </select>
          </div>
          {preview && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              ≈ <strong>{preview.calories} kcal</strong> • {preview.protein} g {t.foods.proteinShort} • {preview.carbs} g {t.foods.carbsShort} • {preview.fat} g {t.foods.fatShort}
            </p>
          )}
          {grams > 0 && (
            <button type="button" onClick={() => setShowFacts((v) => !v)} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
              {showFacts ? t.nutritionFacts.hide : t.nutritionFacts.show}
            </button>
          )}
          {showFacts && grams > 0 && <NutritionFactsTable food={selected} grams={grams} />}
        </div>
      )}

      <div className="flex">
        <button
          type="button"
          onClick={confirm}
          disabled={busy || !selected || !preview}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
