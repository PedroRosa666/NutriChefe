import { describe, expect, it } from 'vitest';
import { groupEqualDays, itemNutrition, itemsCalories, itemsTotals, mealBlocks, nextOptionGroup } from '../plan-items';
import type { MealPlanItem } from '../../services/care';
import type { Food } from '../../services/foods';
import type { Recipe } from '../../types/recipe';

const pao: Food = {
  id: 'f-pao', taco_id: 52, owner_id: null, name: 'Pão, trigo, forma, integral', category: 'Cereais',
  kcal: 253, protein: 9.4, carbs: 49.9, fat: 3.7, fiber: 6.9, sodium: 506, nutrients: {}, measures: [],
};
const tapioca: Food = { ...pao, id: 'f-tap', taco_id: 124, name: 'Fécula, de mandioca', kcal: 331, protein: 0.5, carbs: 81.1, fat: 0.3, fiber: 0.6 };
const recipes = new Map([['r1', { id: 'r1', nutritionFacts: { calories: 400, protein: 30, carbs: 40, fat: 10, fiber: 5 } } as Recipe]]);

const base = { day: 0, meal: 'breakfast' as const, servings: 1, note: '', measure_label: null };
const food = (f: Food, grams: number, group: number | null = null): MealPlanItem => ({ ...base, recipe_id: null, food_id: f.id, food: f, grams, option_group: group });
const recipe = (servings: number, group: number | null = null): MealPlanItem => ({ ...base, recipe_id: 'r1', food_id: null, grams: null, servings, option_group: group });

describe('itemNutrition', () => {
  it('calcula alimento pelos gramas e receita pelas porções', () => {
    expect(itemNutrition(food(pao, 50), recipes)).toEqual({ calories: 127, protein: 4.7, carbs: 25, fat: 1.9, fiber: 3.5 });
    expect(itemNutrition(recipe(1.5), recipes)?.calories).toBe(600);
  });
});

describe('mealBlocks', () => {
  it('junta as opções do mesmo grupo e mantém os itens fixos', () => {
    const items = [recipe(1), food(pao, 50, 1), food(tapioca, 60, 1)];
    const blocks = mealBlocks(items);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('single');
    expect(blocks[1].kind === 'choice' && blocks[1].items.length).toBe(2);
  });
});

describe('itemsCalories', () => {
  it('conta só a primeira opção de cada grupo', () => {
    // recipe 400 + pão 50 g (127); a tapioca é alternativa ao pão e não soma
    expect(itemsCalories([recipe(1), food(pao, 50, 1), food(tapioca, 60, 1)], recipes)).toBe(527);
  });

  it('próximo grupo livre', () => {
    expect(nextOptionGroup([recipe(1), food(pao, 50, 2)])).toBe(3);
  });
});

describe('itemsTotals', () => {
  it('soma os macros contando só a primeira opção de cada grupo', () => {
    expect(itemsTotals([recipe(1), food(pao, 50, 1), food(tapioca, 60, 1)], recipes)).toEqual({
      calories: 527, protein: 34.7, carbs: 65, fat: 11.9, fiber: 8.5,
    });
  });
});

describe('groupEqualDays', () => {
  const on = (day: number, item: MealPlanItem) => ({ ...item, day });
  it('junta dias seguidos iguais e separa os diferentes', () => {
    const items = [0, 1, 2, 3, 4].map((d) => on(d, recipe(1))).concat([on(5, food(pao, 50)), on(6, recipe(1))]);
    expect(groupEqualDays(items).map((g) => g.days)).toEqual([[0, 1, 2, 3, 4], [5], [6]]);
  });
  it('não junta dias iguais separados por um dia vazio', () => {
    expect(groupEqualDays([on(0, recipe(1)), on(2, recipe(1))]).map((g) => g.days)).toEqual([[0], [2]]);
  });
});
