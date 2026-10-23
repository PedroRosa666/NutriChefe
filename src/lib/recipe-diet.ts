// Categoria de dieta (vegana, vegetariana, sem glúten) conferida pelos ingredientes, com a
// mesma regra das alergias. Usado ao salvar receitas e no filtro de categorias.
import { conflictsWithDiet, dietConflictLines, type SearchableRecipe } from '../../supabase/functions/_shared/recipe-search';
import { confirmDialog } from '../store/confirm';
import type { Recipe } from '../types/recipe';
import type { Translations } from '../hooks/useTranslation';

const asSearchable = (r: Recipe): SearchableRecipe => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  ingredients: r.ingredients ?? [],
  prepTime: r.prepTime,
  difficulty: r.difficulty,
  rating: r.rating,
  calories: r.nutritionFacts?.calories ?? 0,
  protein: r.nutritionFacts?.protein ?? 0,
});

/** A receita serve para a dieta da própria categoria? (Categoria sem regra, como low carb: sempre.) */
export const fitsOwnDiet = (r: Recipe): boolean => !conflictsWithDiet(asSearchable(r), r.category);

/**
 * Antes de salvar: se os ingredientes contrariam a categoria escolhida, mostra o que conflita
 * e pergunta. Devolve true para seguir com o salvamento.
 */
export async function confirmDietCategory(recipe: Partial<Recipe>, t: Translations): Promise<boolean> {
  const category = recipe.category ?? '';
  const lines = dietConflictLines(
    { title: recipe.title ?? '', ingredients: (recipe.ingredients ?? []).filter(Boolean) },
    category
  );
  if (!lines.length) return true;
  const label = t.categories[category as keyof typeof t.categories] ?? category;
  const found = lines.slice(0, 2).map((l) => `"${l.trim().slice(0, 60)}"`).join(', ');
  return confirmDialog(t.recipe.dietConflict.replace('{category}', label).replace('{found}', found));
}
