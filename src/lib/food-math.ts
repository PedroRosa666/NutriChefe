import type { Food, FoodMeasure } from '../services/foods';
import type { NutritionTotals } from '../store/nutrition-tracking';
import { normalizeText } from '../../supabase/functions/_shared/recipe-search';
import { scaleExtraNutrients } from './nutrients';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nutrientes de `grams` gramas de um alimento (valores do catálogo são por 100 g). */
export function nutrientsFor(food: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'>, grams: number): NutritionTotals {
  const f = grams / 100;
  return {
    calories: Math.round(food.kcal * f),
    protein: round1(food.protein * f),
    carbs: round1(food.carbs * f),
    fat: round1(food.fat * f),
    fiber: round1(food.fiber * f),
  };
}

/** Texto da quantidade: "2 × 1 fatia (50 g)" ou "150 g". */
export function quantityLabel(amount: number, measure: FoodMeasure | null): string {
  if (!measure) return `${amount} g`;
  const grams = Math.round(amount * measure.grams);
  return amount === 1 ? `${measure.label} (${grams} g)` : `${amount} × ${measure.label} (${grams} g)`;
}

/**
 * Busca sem acento e por palavras em qualquer ordem ("frango grelhado" acha
 * "Frango, peito, sem pele, grelhado"). Alimentos próprios do nutricionista aparecem primeiro.
 */
export function searchFoods(foods: Food[], query: string, limit = 20): Food[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  const matches = words.length
    ? foods.filter((food) => {
        const name = normalizeText(food.name);
        return words.every((w) => name.includes(w));
      })
    : foods;
  return [...matches]
    .sort((a, b) => Number(Boolean(b.owner_id)) - Number(Boolean(a.owner_id)) || a.name.length - b.name.length)
    .slice(0, limit);
}

/** Valores para gravar no diário: os 5 principais + todos os outros nutrientes da porção. */
export function foodLogValues(food: Food, grams: number): { totals: NutritionTotals; extra: Record<string, number> } {
  const extra: Record<string, number> = { ...scaleExtraNutrients(food.nutrients, grams) };
  if (food.sodium !== null) extra.sodium = Math.round((food.sodium * grams) / 100);
  return { totals: nutrientsFor(food, grams), extra };
}
