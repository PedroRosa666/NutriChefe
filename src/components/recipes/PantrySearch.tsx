import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Refrigerator, X, Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { recipesWithIngredients, type SearchableRecipe } from '../../../supabase/functions/_shared/recipe-search';
import { QUICK } from '../../lib/motion';
import type { Recipe } from '../../types/recipe';
import { useRecipesStore } from '../../store/recipes';
import { recipeImageFallback } from '../../lib/recipe-image';

const toSearchable = (r: Recipe): SearchableRecipe & { source: Recipe } => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  ingredients: r.ingredients,
  prepTime: r.prepTime,
  difficulty: r.difficulty,
  rating: r.rating,
  calories: r.nutritionFacts.calories,
  protein: r.nutritionFacts.protein,
  source: r,
});

/** "O que tem em casa?": ingredientes em chips e receitas que usam o máximo deles. */
export function PantrySearch() {
  const t = useTranslation();
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  // Procura em todo o catálogo, não só na página da grade: o índice só baixa quando a
  // pessoa coloca o primeiro ingrediente.
  const recipes = useRecipesStore((s) => s.index);
  useEffect(() => {
    if (items.length) useRecipesStore.getState().ensureIndex();
  }, [items.length]);

  const searchable = useMemo(() => recipes.map(toSearchable), [recipes]);
  const results = useMemo(
    () => (items.length ? recipesWithIngredients(searchable, items).slice(0, 6) : []),
    [searchable, items]
  );

  const add = (raw: string) => {
    // Aceita "ovo, tomate e queijo" de uma vez.
    const parts = raw
      .split(/,|;|\se\s|\sand\s/i)
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 1);
    if (!parts.length) return;
    setItems((prev) => [...new Set([...prev, ...parts])].slice(0, 10));
    setDraft('');
  };

  return (
    <section className="glass-card rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:w-64 sm:flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Refrigerator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t.pantry.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.pantry.subtitle}</p>
          </div>
        </div>
        <form
          className="flex flex-1 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-2 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/60"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
          }}
        >
          {items.map((item) => (
            <span key={item} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 py-1 pl-3 pr-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              {item}
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((i) => i !== item))}
                className="rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800"
                aria-label={`${t.profile.remove} ${item}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !draft && items.length) setItems((prev) => prev.slice(0, -1));
            }}
            placeholder={items.length ? '' : t.pantry.placeholder}
            className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none dark:text-white"
            aria-label={t.pantry.title}
          />
          {draft.trim() ? (
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" />
              {t.pantry.add}
            </button>
          ) : (
            items.length > 0 && (
              <button type="button" onClick={() => setItems([])} className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                {t.pantry.clear}
              </button>
            )
          )}
        </form>
      </div>

      <AnimatePresence initial={false}>
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden">
            <div className="pt-4">
              {!results.length ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.pantry.none}</p>
              ) : (
                <>
                  <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {results.length} {t.pantry.results}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {results.map(({ recipe, matched }) => (
                      <Link
                        key={recipe.id}
                        to={`/receita/${recipe.id}`}
                        className="flex items-center gap-3 rounded-xl bg-white/70 p-2 transition hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-900"
                      >
                        <img src={recipe.source.image} alt="" onError={recipeImageFallback} className="h-14 w-14 flex-shrink-0 rounded-lg bg-slate-100 object-cover dark:bg-slate-800" loading="lazy" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{recipe.title}</p>
                          <p className="truncate text-xs text-emerald-700 dark:text-emerald-300">
                            {t.pantry.has}: {matched.join(', ')}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {recipe.prepTime} min • {Math.round(recipe.calories)} kcal
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
