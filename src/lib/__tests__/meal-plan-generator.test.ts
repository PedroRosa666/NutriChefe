import { describe, expect, it } from 'vitest';
import { generateWeeklyPlan, generateWeeklyPlanDetailed } from '../meal-plan-generator';
import type { Recipe } from '../../types/recipe';

const recipe = (id: string, title: string, ingredients: string[], calories: number, category = 'vegetarian'): Recipe => ({
  id,
  title,
  description: '',
  image: '',
  prepTime: 20,
  difficulty: 'easy',
  rating: 4,
  reviewCount: 0,
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

  it('gerar de novo (outra semente) muda o cardápio', () => {
    const big = Array.from({ length: 30 }, (_, i) => recipe(`r${i}`, `Prato ${i}`, ['arroz'], 350 + i * 7));
    const sig = (seed: number) =>
      generateWeeklyPlan({ recipes: big, dailyCalories: 2000, allergies: [], preferences: [], seed })
        .map((i) => i.recipe_id)
        .join(',');
    const results = new Set([1, 2, 3, 4, 5].map(sig));
    expect(results.size).toBeGreaterThan(1);
  });

  it('sem receitas compatíveis devolve vazio', () => {
    expect(generateWeeklyPlan({ recipes: [], dailyCalories: 2000, allergies: [], preferences: [] })).toEqual([]);
  });
});

describe('dietas e preferências', () => {
  const ids = (items: { recipe_id: string | null }[]) => new Set(items.map((i) => i.recipe_id));

  it('dieta é restrição: com poucas receitas veganas, repete as que servem em vez de soltar a dieta', async () => {
    const { generateWeeklyPlanDetailed } = await import('../meal-plan-generator');
    const { items } = generateWeeklyPlanDetailed({ recipes: catalog, dailyCalories: 2000, allergies: [], preferences: ['vegan'], seed: 42 });
    expect(items.length).toBeGreaterThan(0);
    // Só as receitas sem ingrediente animal (3, 5 e 7), mesmo sendo poucas.
    expect([...ids(items)].every((id) => ['3', '5', '7'].includes(id ?? ''))).toBe(true);
  });

  it('vale o ingrediente, não o rótulo: receita "vegana" com ovo fica de fora', async () => {
    const { generateWeeklyPlanDetailed } = await import('../meal-plan-generator');
    const mislabeled = [...catalog, recipe('8', 'Sanduíche natural', ['pão integral', '1 ovo cozido', 'requeijão'], 350, 'vegan')];
    const { items } = generateWeeklyPlanDetailed({ recipes: mislabeled, dailyCalories: 2000, allergies: [], preferences: ['vegan'], seed: 3 });
    expect(ids(items).has('8')).toBe(false);
  });

  it('sem lactose tira leite e queijo; preferência sem receitas suficientes é avisada', async () => {
    const { generateWeeklyPlanDetailed } = await import('../meal-plan-generator');
    const { items, relaxed } = generateWeeklyPlanDetailed({ recipes: catalog, dailyCalories: 2000, allergies: [], preferences: ['lactoseFree', 'lowCarb'], seed: 5 });
    expect(ids(items).has('4')).toBe(false);
    expect(ids(items).has('6')).toBe(false);
    expect(relaxed).toEqual(['lowCarb']);
  });
});

describe('metas além das calorias', () => {
  const withMacros = (id: string, title: string, calories: number, macros: { protein: number; carbs: number; fat: number; fiber: number }): Recipe => ({
    ...recipe(id, title, ['arroz'], calories),
    nutritionFacts: { calories, ...macros },
  });
  // Mesmas calorias; metade do catálogo tem fibra e gordura muito altas.
  const mixed = [
    ...Array.from({ length: 6 }, (_, i) => withMacros(`ok${i}`, `Prato leve ${i}`, 500, { protein: 30, carbs: 60, fat: 15, fiber: 6 })),
    ...Array.from({ length: 6 }, (_, i) => withMacros(`hi${i}`, `Prato pesado ${i}`, 500, { protein: 10, carbs: 30, fat: 35, fiber: 25 })),
  ];
  const goals = { protein: 120, carbs: 240, fat: 60, fiber: 25 };

  it('com metas de macros, evita as receitas que estouram fibra e gordura', () => {
    const { items, overGoals } = generateWeeklyPlanDetailed({ recipes: mixed, dailyCalories: 2000, goals, allergies: [], preferences: [], seed: 11 });
    const heavy = items.filter((i) => i.recipe_id!.startsWith('hi')).length;
    expect(heavy).toBeLessThan(items.length / 4);
    expect(overGoals).toEqual([]);
  });

  it('sem receitas que caibam, avisa o que passou da meta em vez de esconder', () => {
    const onlyHeavy = mixed.filter((r) => r.id.startsWith('hi'));
    const { overGoals } = generateWeeklyPlanDetailed({ recipes: onlyHeavy, dailyCalories: 2000, goals, allergies: [], preferences: [], seed: 2 });
    expect(overGoals.some((o) => o.key === 'fiber')).toBe(true);
    expect(overGoals.some((o) => o.key === 'fat')).toBe(true);
  });
});

describe('newExcesses', () => {
  it('aponta só a meta que passa a estourar com o item novo', async () => {
    const { newExcesses } = await import('../plan-goals');
    const goals = { calories: 2000, protein: 100, carbs: 250, fat: 70, fiber: 25 };
    const before = { calories: 1500, protein: 80, carbs: 180, fat: 50, fiber: 22 };
    const after = { calories: 1800, protein: 90, carbs: 200, fat: 60, fiber: 36 };
    expect(newExcesses(before, after, goals).map((e) => e.key)).toEqual(['fiber']);
    // Fibra já acima antes: não repete o aviso.
    expect(newExcesses(after, { ...after, fiber: 40 }, goals)).toEqual([]);
  });
});
