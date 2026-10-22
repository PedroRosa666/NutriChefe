// Regras do plano alimentar usadas pelo editor do nutricionista e pela tela do paciente.
import type { MealPlanItem } from '../services/care';
import type { NutritionTotals } from '../store/nutrition-tracking';
import type { Recipe } from '../types/recipe';
import { nutrientsFor } from './food-math';

export type PlanBlock =
  | { kind: 'single'; item: MealPlanItem }
  | { kind: 'choice'; group: number; items: MealPlanItem[] };

/** Nutrientes de um item (receita × porções ou alimento × gramas); null se a receita/alimento sumiu. */
export function itemNutrition(item: MealPlanItem, recipesById: Map<string, Recipe>): NutritionTotals | null {
  if (item.food_id) {
    return item.food && item.grams ? nutrientsFor(item.food, item.grams) : null;
  }
  const recipe = item.recipe_id ? recipesById.get(item.recipe_id) : undefined;
  if (!recipe) return null;
  const f = item.servings;
  const n = recipe.nutritionFacts;
  return {
    calories: Math.round(n.calories * f),
    protein: Math.round(n.protein * f * 10) / 10,
    carbs: Math.round(n.carbs * f * 10) / 10,
    fat: Math.round(n.fat * f * 10) / 10,
    fiber: Math.round(n.fiber * f * 10) / 10,
  };
}

/** Item ainda existe (receita no catálogo ou alimento carregado)? */
export const isItemAvailable = (item: MealPlanItem, recipesById: Map<string, Recipe>) =>
  item.food_id ? Boolean(item.food) : Boolean(item.recipe_id && recipesById.has(item.recipe_id));

/**
 * Agrupa os itens de UMA refeição: itens sem grupo ficam soltos; itens com o mesmo
 * `option_group` viram um bloco "escolha 1". A ordem segue a primeira aparição.
 */
export function mealBlocks(items: MealPlanItem[]): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  const groups = new Map<number, { kind: 'choice'; group: number; items: MealPlanItem[] }>();
  for (const item of items) {
    if (item.option_group === null) {
      blocks.push({ kind: 'single', item });
      continue;
    }
    let block = groups.get(item.option_group);
    if (!block) {
      block = { kind: 'choice', group: item.option_group, items: [] };
      groups.set(item.option_group, block);
      blocks.push(block);
    }
    block.items.push(item);
  }
  return blocks;
}

/**
 * Nutrientes de um conjunto de itens: itens fixos somam inteiros; de cada grupo de opções
 * conta só a primeira (as opções são equivalentes, a pessoa come uma delas).
 */
export function itemsTotals(items: MealPlanItem[], recipesById: Map<string, Recipe>): NutritionTotals {
  const counted = new Set<string>();
  const total: NutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const item of items) {
    if (item.option_group !== null) {
      const key = `${item.day}-${item.meal}-${item.option_group}`;
      if (counted.has(key)) continue;
      counted.add(key);
    }
    const n = itemNutrition(item, recipesById);
    if (!n) continue;
    total.calories += n.calories;
    total.protein += n.protein;
    total.carbs += n.carbs;
    total.fat += n.fat;
    total.fiber += n.fiber;
  }
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    calories: Math.round(total.calories),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
    fiber: round1(total.fiber),
  };
}

export const itemsCalories = (items: MealPlanItem[], recipesById: Map<string, Recipe>): number =>
  itemsTotals(items, recipesById).calories;

/** Assinatura do cardápio de um dia (o que se come, sem ids), para juntar dias iguais. */
const daySignature = (items: MealPlanItem[]) =>
  JSON.stringify(
    items.map((i) => [i.meal, i.recipe_id, i.food_id, i.servings, i.grams, i.measure_label, i.option_group, i.note])
  );

/**
 * Agrupa dias seguidos com o mesmo cardápio (ex.: segunda a sexta iguais viram um bloco).
 * Dias sem itens ficam de fora. Os itens de cada dia mantêm a ordem recebida.
 */
export function groupEqualDays(items: MealPlanItem[]): { days: number[]; items: MealPlanItem[] }[] {
  const groups: { days: number[]; items: MealPlanItem[]; sig: string }[] = [];
  for (let day = 0; day < 7; day++) {
    const dayItems = items.filter((i) => i.day === day);
    if (!dayItems.length) continue;
    const sig = daySignature(dayItems);
    const last = groups[groups.length - 1];
    if (last && last.sig === sig && last.days[last.days.length - 1] === day - 1) last.days.push(day);
    else groups.push({ days: [day], items: dayItems, sig });
  }
  return groups.map(({ days, items: dayItems }) => ({ days, items: dayItems }));
}

/** Próximo número livre de grupo de opções numa refeição. */
export function nextOptionGroup(items: MealPlanItem[]): number {
  return items.reduce((max, i) => Math.max(max, i.option_group ?? 0), 0) + 1;
}
