import { useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Plus } from 'lucide-react';
import { estimateFoodPhoto, type PhotoEstimate } from '../../services/gemini';
import { useNutritionTrackingStore, type NutritionTotals } from '../../store/nutrition-tracking';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { COMMON_FOODS, type CommonFood } from '../../lib/foods';
import { normalizeText } from '../../../supabase/functions/_shared/recipe-search';
import { cn } from '../../lib/utils';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

const parseAmount = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Alimentos comuns (Tabela TACO): busca, escolhe a porção e registra. */
export function CommonFoodForm({ date }: { date: string }) {
  const t = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const { showToast } = useToastStore();
  const addFoodToLog = useNutritionTrackingStore((s) => s.addFoodToLog);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CommonFood | null>(null);
  const [portions, setPortions] = useState('1');
  const [adding, setAdding] = useState(false);

  const name = (f: CommonFood) => (language === 'pt' ? f.pt : f.en);
  const portion = (f: CommonFood) => (language === 'pt' ? f.portionPt : f.portionEn);

  const matches = useMemo(() => {
    const q = normalizeText(query);
    const list = q ? COMMON_FOODS.filter((f) => normalizeText(`${f.pt} ${f.en}`).includes(q)) : COMMON_FOODS;
    return list.slice(0, 8);
  }, [query]);

  const add = async () => {
    const amount = parseAmount(portions);
    if (!selected || !amount) {
      showToast(t.profile.invalidServings, 'warning');
      return;
    }
    setAdding(true);
    try {
      const { calories, protein, carbs, fat, fiber } = selected;
      await addFoodToLog(`${name(selected)} (${portion(selected)})`, { calories, protein, carbs, fat, fiber }, amount, date);
      showToast(t.profile.loggedToDiary, 'success');
      setSelected(null);
      setQuery('');
      setPortions('1');
    } catch (error) {
      console.error('Error logging food:', error);
      showToast(t.profile.diaryError, 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.foods.search} className={inputClass} />
      <div className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
        {matches.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelected(f)}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              selected?.id === f.id
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-200 hover:border-emerald-300 dark:border-slate-700'
            )}
          >
            <span className="block font-medium text-slate-900 dark:text-white">{name(f)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {portion(f)} • {f.calories} kcal
            </span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          {t.foods.portions}
          <input type="number" min={0.5} step={0.5} value={portions} onChange={(e) => setPortions(e.target.value)} className={cn(inputClass, 'w-20')} />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={adding || !selected}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.foods.add}
        </button>
      </div>
      <p className="text-[11px] text-slate-400">{t.foods.approx}</p>
    </div>
  );
}

const EMPTY: Record<keyof NutritionTotals, string> = { calories: '', protein: '', carbs: '', fat: '', fiber: '' };

/** Qualquer coisa fora da lista: nome + valores digitados (ou vindos da estimativa por foto). */
export function CustomFoodForm({ date, initial }: { date: string; initial?: { name: string; values: Partial<NutritionTotals> } | null }) {
  const t = useTranslation();
  const { showToast } = useToastStore();
  const addFoodToLog = useNutritionTrackingStore((s) => s.addFoodToLog);
  const [name, setName] = useState(initial?.name ?? '');
  const [values, setValues] = useState(() => {
    const v = { ...EMPTY };
    for (const key of Object.keys(EMPTY) as (keyof NutritionTotals)[]) {
      if (initial?.values[key] !== undefined) v[key] = String(Math.round((initial.values[key] ?? 0) * 10) / 10);
    }
    return v;
  });
  const [adding, setAdding] = useState(false);
  const labels = t.profile.nutritionGoalsnames;

  const add = async () => {
    const kcal = parseAmount(values.calories);
    if (!name.trim() || kcal === null) {
      showToast(t.foods.invalid, 'warning');
      return;
    }
    setAdding(true);
    try {
      const num = (v: string) => parseAmount(v) ?? 0;
      await addFoodToLog(
        name.trim(),
        { calories: kcal, protein: num(values.protein), carbs: num(values.carbs), fat: num(values.fat), fiber: num(values.fiber) },
        1,
        date
      );
      showToast(t.profile.loggedToDiary, 'success');
      setName('');
      setValues({ ...EMPTY });
    } catch (error) {
      console.error('Error logging custom food:', error);
      showToast(t.profile.diaryError, 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.foods.customName}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder={t.foods.customNamePlaceholder} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(EMPTY) as (keyof NutritionTotals)[]).map((key) => (
          <label key={key} className="space-y-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {labels[key]} ({key === 'calories' ? 'kcal' : 'g'})
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={values[key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={add}
          disabled={adding}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.foods.add}
        </button>
      </div>
    </div>
  );
}

/** Foto do prato -> estimativa da IA, que preenche o formulário "Outro" para revisão. */
export function PhotoEstimateButton({ onResult }: { onResult: (estimate: PhotoEstimate) => void }) {
  const t = useTranslation();
  const { showToast } = useToastStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast(t.photo.tooBig, 'warning');
      return;
    }
    setBusy(true);
    try {
      const estimate = await estimateFoodPhoto(file);
      onResult(estimate);
      showToast(t.photo.disclaimer, 'info');
    } catch (error) {
      console.error('Photo estimate failed:', error);
      showToast(t.photo.error, 'error');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {busy ? t.photo.analyzing : t.photo.button}
      </button>
    </>
  );
}
