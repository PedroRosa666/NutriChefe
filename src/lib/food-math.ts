import type { Food, FoodMeasure, PickedFood } from '../services/foods';
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

/** Parte das calorias vinda de proteína, carboidrato e gordura (0 a 1 cada). */
function macroShares(food: Food) {
  const total = food.protein * 4 + food.carbs * 4 + food.fat * 9 || 1;
  return [(food.protein * 4) / total, (food.carbs * 4) / total, (food.fat * 9) / total];
}

/**
 * Quantidade de um alimento para dar `kcal` calorias: em medida caseira quando alguma
 * fica a até 15% (de meia em meia medida), senão em gramas de 5 em 5.
 */
export function amountForCalories(food: Food, kcal: number): PickedFood | null {
  if (food.kcal <= 0) return null;
  const exact = (kcal * 100) / food.kcal;
  for (const m of food.measures) {
    if (m.grams <= 0) continue;
    const amount = Math.max(0.5, Math.round((exact / m.grams) * 2) / 2);
    const grams = Math.round(amount * m.grams);
    if (Math.abs(grams - exact) / exact <= 0.15) return { food, grams, label: quantityLabel(amount, m) };
  }
  const grams = Math.max(5, Math.round(exact / 5) * 5);
  return { food, grams, label: `${grams} g` };
}

/**
 * Alimentos equivalentes para uma lista de substituição: mesmo grupo (categoria), quantidade
 * calculada para dar as mesmas calorias e ordenados pelo perfil de macronutrientes mais parecido.
 * Quantidades absurdas (mais de 500 g) ficam de fora.
 */
export function suggestEquivalents(base: Food, baseGrams: number, foods: Food[], exclude: string[] = [], limit = 6): PickedFood[] {
  const kcal = (base.kcal * baseGrams) / 100;
  if (kcal <= 0) return [];
  const target = macroShares(base);
  const skip = new Set([base.id, ...exclude]);
  return foods
    .filter((f) => !skip.has(f.id) && f.category === base.category && f.kcal > 0)
    .map((f) => {
      const shares = macroShares(f);
      return { f, distance: shares.reduce((sum, v, i) => sum + Math.abs(v - target[i]), 0) };
    })
    .sort((a, b) => a.distance - b.distance)
    .map(({ f }) => amountForCalories(f, kcal))
    .filter((p): p is PickedFood => p !== null && p.grams <= 500)
    .slice(0, limit);
}
