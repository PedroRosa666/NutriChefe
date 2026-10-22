import { describe, expect, it } from 'vitest';
import { generateWeeklyPlan } from '../meal-plan-generator';
import type { Recipe } from '../../types/recipe';

const recipe = (id: string, title: string, ingredients: string[], calories: number, category = 'vegetarian'): Recipe => ({
  id,
  title,
  description: '',
  image: '',
  prepTime: 20,
  difficulty: 'easy',
  rating: 4,
  category,
  ingredients,
  instructions: [],
  nutritionFacts: { calories, protein: 10, carbs: 30, fat: 5, fiber: 3 },
  reviews: [],
  authorId: 'a',
  createdAt: '',
  updatedAt: '',
});

const catalog = [
  recipe('1', 'Panqueca de aveia', ['1 xícara de aveia', '2 ovos', '1 banana'], 320),
  recipe('2', 'Frango grelhado com legumes', ['200 g de frango', 'brócolis'], 450, 'highProtein'),
  recipe('3', 'Salada de grão-de-bico', ['grão-de-bico', 'tomate'], 380, 'vegan'),
  recipe('4', 'Smoothie de morango', ['morango', 'leite'], 180),
  recipe('5', 'Sopa de lentilha', ['lentilha', 'cenoura'], 300, 'vegan'),
  recipe('6', 'Risoto de cogumelos', ['arroz', 'cogumelos', 'queijo parmesão'], 520),
  recipe('7', 'Bolinho de amendoim', ['amendoim', 'aveia'], 200),
];

describe('generateWeeklyPlan', () => {
  it('preenche 7 dias x 4 refeições', () => {
    const items = generateWeeklyPlan({ recipes: catalog, dailyCalories: 2000, allergies: [], preferences: [], seed: 42 });
    expect(items).toHaveLength(28);
    for (let day = 0; day < 7; day++) expect(items.filter((i) => i.day === day)).toHaveLength(4);
  });

  it('respeita alergias (com grupos: lactose tira leite e queijo)', () => {
    const items = generateWeeklyPlan({ recipes: catalog, dailyCalories: 2000, allergies: ['lactose', 'amendoim'], preferences: [], seed: 1 });
    const used = new Set(items.map((i) => i.recipe_id));
    expect(used.has('4')).toBe(false); // leite
    expect(used.has('6')).toBe(false); // queijo
    expect(used.has('7')).toBe(false); // amendoim
  });

  it('ajusta porções para perto da meta diária', () => {
    const items = generateWeeklyPlan({ recipes: catalog, dailyCalories: 2000, allergies: [], preferences: [], seed: 7 });
    const byId = new Map(catalog.map((r) => [r.id, r]));
    const day0 = items.filter((i) => i.day === 0).reduce((s, i) => s + byId.get(i.recipe_id!)!.nutritionFacts.calories * i.servings, 0);
    expect(day0).toBeGreaterThan(1400);
    expect(day0).toBeLessThan(2600);
  });

  it('sem receitas compatíveis devolve vazio', () => {
    expect(generateWeeklyPlan({ recipes: [], dailyCalories: 2000, allergies: [], preferences: [] })).toEqual([]);
  });
});
