import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Shuffle } from 'lucide-react';
import { useFoodsStore } from '../../store/foods';
import { useTranslation } from '../../hooks/useTranslation';
import { suggestEquivalents } from '../../lib/food-math';
import type { Food, PickedFood } from '../../services/foods';

interface EquivalentFoodsProps {
  base: Food;
  grams: number;
  /** Alimentos que já estão na lista (não sugerir de novo). */
  exclude?: string[];
  /** Texto do botão de cada sugestão (ex.: "Adicionar como opção"). */
  pickLabel: string;
  onPick: (picked: PickedFood) => void;
  /** Já abre mostrando as sugestões. */
  defaultOpen?: boolean;
}

/** Sugestões de substituição: mesmo grupo de alimentos, mesmas calorias, macros parecidos. */
export function EquivalentFoods({ base, grams, exclude = [], pickLabel, onPick, defaultOpen = false }: EquivalentFoodsProps) {
  const t = useTranslation();
  const s = t.equivalents;
  const { foods, loaded, fetch } = useFoodsStore();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (open) fetch().catch((error) => console.error('Error loading foods:', error));
  }, [open, fetch]);

  const excludeKey = exclude.join(',');
  const list = useMemo(
    () => (open && loaded ? suggestEquivalents(base, grams, foods, excludeKey ? excludeKey.split(',') : []) : []),
    [open, loaded, base, grams, foods, excludeKey]
  );
  const kcal = Math.round((base.kcal * grams) / 100);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-violet-300 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/20"
      >
        <Shuffle className="h-3.5 w-3.5" />
        {s.show}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 dark:border-violet-900/40 dark:bg-violet-900/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-violet-900 dark:text-violet-200">
          <span className="font-semibold">{s.title}</span> {s.basis.replace('{name}', base.name).replace('{kcal}', String(kcal))}
        </p>
        <button type="button" onClick={() => setOpen(false)} className="flex-shrink-0 text-xs font-semibold text-violet-700 dark:text-violet-300">
          {s.hide}
        </button>
      </div>
      {!loaded ? (
        <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
      ) : !list.length ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{s.none}</p>
      ) : (
        <ul className="space-y-1">
          {list.map((p) => (
            <li key={p.food.id} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 dark:bg-slate-900">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-900 dark:text-white">{p.food.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {p.label} • {Math.round((p.food.kcal * p.grams) / 100)} kcal • P {Math.round((p.food.protein * p.grams) / 10) / 10} g • C{' '}
                  {Math.round((p.food.carbs * p.grams) / 10) / 10} g • G {Math.round((p.food.fat * p.grams) / 10) / 10} g
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                aria-label={`${pickLabel}: ${p.food.name}`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{pickLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
