import { useMemo, useState } from 'react';
import { BookOpen, Carrot, Search } from 'lucide-react';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';
import { normalizeText } from '../../../supabase/functions/_shared/recipe-search';
import { recipesWithoutAllergens } from '../../lib/meal-plan-generator';
import type { Food } from '../../services/foods';
import type { SwapChoice } from '../../services/swaps';
import type { Recipe } from '../../types/recipe';
import { FoodQuantityPicker } from '../foods/FoodQuantityPicker';
import { EquivalentFoods } from '../foods/EquivalentFoods';
import { cn } from '../../lib/utils';
import { fmtNum } from '../../lib/format';

interface SwapChoicePickerProps {
  /** Calorias do item atual: as receitas sugeridas vêm com as porções para chegar perto delas. */
  targetKcal: number | null;
  /** Alimento atual (para sugerir equivalentes). */
  baseFood?: { food: Food; grams: number } | null;
  /** Receitas com esses alérgenos ficam de fora. */
  allergies: string[];
  confirmLabel: string;
  onChoose: (choice: SwapChoice) => void;
}

/** Porções (de meia em meia, entre 0,5 e 3) para a receita dar perto de `kcal`. */
const servingsFor = (recipe: Recipe, kcal: number | null) => {
  const per = recipe.nutritionFacts.calories;
  if (!kcal || per <= 0) return 1;
  return Math.min(3, Math.max(0.5, Math.round((kcal / per) * 2) / 2));
};

/** Escolha do que entra no lugar de um item do plano: um alimento do catálogo ou uma receita do site. */
export function SwapChoicePicker({ targetKcal, baseFood, allergies, confirmLabel, onChoose }: SwapChoicePickerProps) {
  const t = useTranslation();
  const s = t.swaps;
  const recipes = useRecipesStore((st) => st.recipes);
  const [kind, setKind] = useState<'food' | 'recipe'>('food');
  const [query, setQuery] = useState('');

  const safe = useMemo(() => recipesWithoutAllergens(recipes, allergies), [recipes, allergies]);
  const list = useMemo(() => {
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    if (words.length) {
      return safe
        .filter((r) => {
          const title = normalizeText(r.title);
          return words.every((w) => title.includes(w));
        })
        .slice(0, 12);
    }
    // Sem busca: as de calorias mais parecidas com o item atual (ou as mais bem avaliadas).
    const sorted = targetKcal
      ? [...safe].sort(
          (a, b) =>
            Math.abs(a.nutritionFacts.calories * servingsFor(a, targetKcal) - targetKcal) -
            Math.abs(b.nutritionFacts.calories * servingsFor(b, targetKcal) - targetKcal)
        )
      : [...safe].sort((a, b) => b.rating - a.rating);
    return sorted.slice(0, 8);
  }, [safe, query, targetKcal]);

  const tabClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5',
      active ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'
    );

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold dark:bg-slate-800" role="tablist">
        <button type="button" role="tab" aria-selected={kind === 'food'} onClick={() => setKind('food')} className={tabClass(kind === 'food')}>
          <Carrot className="h-3.5 w-3.5" />
          {s.kindFood}
        </button>
        <button type="button" role="tab" aria-selected={kind === 'recipe'} onClick={() => setKind('recipe')} className={tabClass(kind === 'recipe')}>
          <BookOpen className="h-3.5 w-3.5" />
          {s.kindRecipe}
        </button>
      </div>

      {kind === 'food' ? (
        <>
          {baseFood && (
            <EquivalentFoods
              base={baseFood.food}
              grams={baseFood.grams}
              pickLabel={confirmLabel}
              onPick={(picked) => onChoose({ kind: 'food', picked })}
              defaultOpen
            />
          )}
          <FoodQuantityPicker confirmLabel={confirmLabel} onConfirm={(picked) => onChoose({ kind: 'food', picked })} />
        </>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.recipeSearch}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          {!query.trim() && targetKcal ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.recipeSuggestHint.replace('{kcal}', String(Math.round(targetKcal)))}</p>
          ) : null}
          {!list.length ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.recipeNone}</p>
          ) : (
            <ul className="space-y-1.5">
              {list.map((r) => {
                const servings = servingsFor(r, targetKcal);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                    <img src={r.image} alt="" loading="lazy" className="h-10 w-10 flex-shrink-0 rounded-md bg-slate-100 object-cover dark:bg-slate-800" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{r.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {fmtNum(servings)} {t.plan.servingsShort} • {Math.round(r.nutritionFacts.calories * servings)} kcal
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChoose({ kind: 'recipe', recipeId: r.id, title: r.title, servings })}
                      className="flex-shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      {s.pick}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
