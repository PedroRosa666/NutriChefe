// Endereço público da receita: /receita/<id>/<nome-da-receita>. O id manda (links antigos, só com o
// id, continuam abrindo); o nome no fim é para quem lê o link e para os buscadores.
import { normalizeText } from '../../supabase/functions/_shared/recipe-search';

export function recipeSlug(title: string): string {
  return normalizeText(title).split(' ').filter(Boolean).slice(0, 10).join('-');
}

export function recipePath(recipe: { id: string; title: string }): string {
  const slug = recipeSlug(recipe.title);
  return slug ? `/receita/${recipe.id}/${slug}` : `/receita/${recipe.id}`;
}
