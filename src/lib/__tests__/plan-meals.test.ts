import { describe, expect, it } from 'vitest';
import { copyMealsAndItems, dayShares, defaultMeals, definedShareSum, mealGuidanceOn, mealTimeOn, mealsFromLegacy, toPlanMeal } from '../plan-meals';
import { generateWeeklyPlanDetailed } from '../meal-plan-generator';
import type { MealPlanItem, PlanMeal } from '../../services/care';
import type { Recipe } from '../../types/recipe';

const NAMES = { breakfast: 'Café da manhã', lunch: 'Almoço', snack: 'Lanche', dinner: 'Jantar' };
const item = (day: number, mealId: string, id?: string): MealPlanItem => ({
  id, day, meal_id: mealId, recipe_id: 'r', servings: 1, food_id: null, grams: null, measure_label: null, option_group: null, note: '',
});

describe('blocos de refeição', () => {
  it('plano novo começa com as quatro refeições de sempre, cada uma com id próprio', () => {
    const meals = defaultMeals(NAMES);
    expect(meals.map((m) => m.name)).toEqual(['Café da manhã', 'Almoço', 'Lanche', 'Jantar']);
    expect(new Set(meals.map((m) => m.id)).size).toBe(4);
  });

  it('REF 09: copiar (modelo, duplicar) cria ids novos e não leva ids de itens', () => {
    const meals = defaultMeals(NAMES);
    const items = [item(0, meals[0].id, 'i1'), item(1, meals[2].id, 'i2')];
    const copy = copyMealsAndItems(meals, items);
    expect(copy.meals.some((m) => meals.some((o) => o.id === m.id))).toBe(false);
    expect(copy.items.every((i) => i.id === undefined)).toBe(true);
    expect(copy.items.map((i) => i.meal_id)).toEqual([copy.meals[0].id, copy.meals[2].id]);
  });

  it('itens antigos (só o código da refeição) viram blocos das categorias usadas', () => {
    const legacy = [{ ...item(0, ''), meal: 'lunch' as const }, { ...item(1, ''), meal: 'snack' as const }];
    const { meals, items } = mealsFromLegacy(legacy, NAMES);
    expect(meals.map((m) => m.name)).toEqual(['Almoço', 'Lanche']);
    expect(items.map((i) => i.meal_id)).toEqual([meals[0].id, meals[1].id]);
  });

  it('REF 10: o nome vem como foi escrito; horário e orientação podem mudar por dia', () => {
    const m = toPlanMeal({ id: 'x', name: 'breakfast', time: '07:00', guidance: 'Geral', day_overrides: { '5': { time: '09:00' }, '9': { time: '01:00' } }, days: [0, 5] });
    expect(m.name).toBe('breakfast');
    expect([mealTimeOn(m, 0), mealTimeOn(m, 5)]).toEqual(['07:00', '09:00']);
    expect(mealGuidanceOn(m, 5)).toBe('Geral');
    expect(Object.keys(m.dayOverrides)).toEqual(['5']);
  });
});

describe('divisão das calorias do dia', () => {
  const block = (id: string, category: PlanMeal['category'], kcalShare: number | null = null): PlanMeal => ({
    id, name: id, category, days: [0], time: null, guidance: '', dayOverrides: {}, kcalShare,
  });

  it('usa as % do profissional quando todos os blocos têm e somam 100', () => {
    const meals = [block('a', 'breakfast', 30), block('b', 'lunch', 70)];
    expect(dayShares(meals, 0)).toEqual({ shares: new Map([['a', 30], ['b', 70]]), suggested: false });
  });

  it('senão, sugere pela categoria, sempre somando 100 (mais uma refeição não aumenta o dia)', () => {
    const four = [block('a', 'breakfast'), block('b', 'lunch'), block('c', 'snack'), block('d', 'dinner')];
    const five = [...four, block('e', null)];
    const sum = (m: Map<string, number>) => Math.round([...m.values()].reduce((x, y) => x + y, 0));
    expect(sum(dayShares(four, 0).shares)).toBe(100);
    expect(sum(dayShares(five, 0).shares)).toBe(100);
    expect(dayShares(five, 0).suggested).toBe(true);
    expect(definedShareSum([block('a', null, 40), block('b', null)], 0)).toBe(40);
  });

  it('o gerador preenche cada bloco do dia e o total do dia segue a meta, com quatro ou seis refeições', () => {
    const recipes = Array.from({ length: 12 }, (_, i) => ({
      id: `r${i}`, title: `Prato ${i}`, description: '', image: '', prepTime: 10, difficulty: 'easy', rating: 4, reviewCount: 0,
      category: 'vegetarian', ingredients: ['arroz'], instructions: [], nutritionFacts: { calories: 250 + i * 20, protein: 10, carbs: 30, fat: 5, fiber: 3 },
      reviews: [], authorId: 'a', createdAt: '', updatedAt: '',
    })) as Recipe[];
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const dayKcal = (items: MealPlanItem[], day: number) => items.filter((i) => i.day === day).reduce((s, i) => s + byId.get(i.recipe_id!)!.nutritionFacts.calories * i.servings, 0);
    const four = defaultMeals(NAMES);
    const six = [...four, { ...four[2], id: 'pre', name: 'Pré-treino', category: null }, { ...four[2], id: 'ceia', name: 'Ceia', category: null }];
    const base = { recipes, dailyCalories: 2000, allergies: [], preferences: [], seed: 9 };
    const a = generateWeeklyPlanDetailed({ ...base, meals: four });
    const b = generateWeeklyPlanDetailed({ ...base, meals: six });
    expect(b.items.filter((i) => i.day === 0).map((i) => i.meal_id)).toEqual(six.map((m) => m.id));
    for (const r of [a, b]) {
      expect(dayKcal(r.items, 0)).toBeGreaterThan(1500);
      expect(dayKcal(r.items, 0)).toBeLessThan(2500);
    }
  });
});
