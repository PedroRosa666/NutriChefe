import type { SyntheticEvent } from 'react';

export const RECIPE_PLACEHOLDER = '/recipe-placeholder.svg';

/**
 * Foto de receita que não carrega (ex.: link de outro site que saiu do ar) vira a ilustração
 * padrão em vez do ícone de imagem quebrada. Use em todo <img> de receita: `onError={recipeImageFallback}`.
 */
export function recipeImageFallback(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (!img.src.endsWith(RECIPE_PLACEHOLDER)) img.src = RECIPE_PLACEHOLDER;
}
