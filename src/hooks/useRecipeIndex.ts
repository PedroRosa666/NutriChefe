import { useEffect } from 'react';
import { useRecipesStore } from '../store/recipes';

/**
 * Cartões de todo o catálogo, para telas que escolhem entre todas as receitas (gerador e
 * editor de plano, trocas, diário, "O que tem em casa?"). Baixa na primeira vez que uma
 * dessas telas abre e reaproveita depois.
 */
export function useRecipeIndex() {
  const index = useRecipesStore((s) => s.index);
  const loaded = useRecipesStore((s) => s.indexLoaded);
  useEffect(() => {
    if (!loaded) useRecipesStore.getState().ensureIndex();
  }, [loaded]);
  return { recipes: index, loaded };
}
