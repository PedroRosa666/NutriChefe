import { useEffect, useState } from 'react';
import { useRecipesStore } from '../store/recipes';
import { getRecipesByIds } from '../services/database';
import type { Recipe } from '../types/recipe';

/** Cartões das receitas favoritas, na ordem em que foram favoritadas (mais recente primeiro). */
export function useFavoriteRecipes(): { recipes: Recipe[]; loading: boolean } {
  const ids = useRecipesStore((s) => s.favoriteRecipes);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);
  const key = ids.join(',');

  useEffect(() => {
    const wanted = key ? key.split(',') : [];
    if (!wanted.length) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getRecipesByIds(wanted)
      .then((rows) => {
        if (cancelled) return;
        const byId = new Map(rows.map((r) => [r.id, r]));
        setRecipes(wanted.slice().reverse().map((id) => byId.get(id)).filter((r): r is Recipe => !!r));
      })
      .catch((error) => console.error('Error loading favorites:', error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { recipes, loading };
}
