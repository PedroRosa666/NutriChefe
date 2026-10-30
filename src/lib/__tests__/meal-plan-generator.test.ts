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

describe('acompanhamentos da TACO', () => {
  const food = (taco_id: number, name: string, kcal: number, carbs: number, protein: number, fat: number, fiber: number, measure?: { label: string; grams: number }) => ({
    id: `f${taco_id}`, taco_id, owner_id: null, name, category: '', kcal, protein, carbs, fat, fiber, sodium: null, nutrients: {}, measures: measure ? [measure] : [],
  });
  const foods = [
    food(3, 'Arroz, tipo 1, cozido', 128, 28.1, 2.5, 0.2, 1.6, { label: '1 colher de sopa', grams: 25 }),
    food(561, 'Feijão, carioca, cozido', 76, 13.6, 4.8, 0.5, 8.5, { label: '1 concha', grams: 140 }),
    food(53, 'Pão, trigo, francês', 300, 58.6, 8, 3.1, 2.3, { label: '1 unidade', grams: 50 }),
    food(182, 'Banana, prata, crua', 98, 26, 1.3, 0.1, 2, { label: '1 unidade', grams: 70 }),
  ];
  // Catálogo só com pratos ricos em proteína e gordura: sem acompanhamento, o carboidrato não fecha.
  const fatty = Array.from({ length: 8 }, (_, i) => ({
    ...recipe(`p${i}`, `Frango com legumes ${i}`, ['frango'], 380),
    nutritionFacts: { calories: 380, protein: 32, carbs: 12, fat: 22, fiber: 4 },
  }));
  const goals = { protein: 110, carbs: 220, fat: 60, fiber: 25 };
  const carbsOf = (items: ReturnType<typeof generateWeeklyPlan>, day: number) =>
    items.filter((i) => i.day === day).reduce((sum, i) => {
      if (i.food && i.grams) return sum + (i.food.carbs * i.grams) / 100;
      const r = fatty.find((x) => x.id === i.recipe_id);
      return sum + (r ? r.nutritionFacts.carbs * i.servings : 0);
    }, 0);

  it('completa o carboidrato com arroz, feijão, pão ou fruta', () => {
    const without = generateWeeklyPlanDetailed({ recipes: fatty, dailyCalories: 2000, goals, allergies: [], preferences: [], seed: 4 });
    const withSides = generateWeeklyPlanDetailed({ recipes: fatty, dailyCalories: 2000, goals, allergies: [], preferences: [], seed: 4, foods });
    expect(withSides.items.some((i) => i.food_id)).toBe(true);
    expect(carbsOf(withSides.items, 0)).toBeGreaterThan(carbsOf(without.items, 0) + 40);
    // No máximo quatro acompanhamentos por dia, com a medida caseira no texto.
    for (let d = 0; d < 7; d++) expect(withSides.items.filter((i) => i.day === d && i.food_id).length).toBeLessThanOrEqual(4);
    expect(withSides.items.find((i) => i.food_id)?.measure_label).toMatch(/colher|concha|unidade/);
  });

  it('respeita restrições: sem glúten não oferece pão', () => {
    const { items } = generateWeeklyPlanDetailed({ recipes: fatty, dailyCalories: 2000, goals, allergies: [], preferences: ['glutenFree'], seed: 4, foods });
    expect(items.some((i) => i.food?.name.startsWith('Pão'))).toBe(false);
  });
});

describe('pratos com cara de prato', () => {
  const food = (taco_id: number, name: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, measure?: { label: string; grams: number }) => ({
    id: `f${taco_id}`, taco_id, owner_id: null, name, category: '', kcal, protein, carbs, fat, fiber, sodium: null, nutrients: {}, measures: measure ? [measure] : [],
  });
  const foods = [
    food(3, 'Arroz, tipo 1, cozido', 128, 2.5, 28.1, 0.2, 1.6, { label: '1 colher de sopa', grams: 25 }),
    food(561, 'Feijão, carioca, cozido', 76, 4.8, 13.6, 0.5, 8.5, { label: '1 concha', grams: 140 }),
    food(410, 'Frango, peito, sem pele, grelhado', 159, 32, 0, 2.5, 0, { label: '1 filé médio', grams: 100 }),
    food(488, 'Ovo, de galinha, inteiro, cozido/10minutos', 146, 13.3, 0.6, 9.5, 0, { label: '1 unidade', grams: 50 }),
    food(100, 'Brócolis, cozido', 25, 2.1, 4.4, 0.5, 3.4),
    food(182, 'Banana, prata, crua', 98, 1.3, 26, 0.1, 2, { label: '1 unidade', grams: 70 }),
    food(448, 'Iogurte, natural', 51, 4.1, 1.9, 3, 0, { label: '1 pote', grams: 170 }),
  ];
  const dish = (id: string, title: string, category: string, n: { calories: number; protein: number; carbs: number; fat: number; fiber: number }) => ({ ...recipe(id, title, [], n.calories, category), nutritionFacts: n });
  const catalog = [
    dish('risoto', 'Risoto de cogumelos', 'vegetarian', { calories: 420, protein: 9, carbs: 60, fat: 14, fiber: 3 }),
    dish('lasanha', 'Lasanha vegana de lentilha', 'vegan', { calories: 300, protein: 12, carbs: 28, fat: 12, fiber: 8 }),
    dish('strog', 'Strogonoff de frango', 'highProtein', { calories: 330, protein: 30, carbs: 8, fat: 16, fiber: 1 }),
    dish('feijoada', 'Feijoada light', 'highProtein', { calories: 330, protein: 25, carbs: 24, fat: 14, fiber: 15 }),
    dish('panq', 'Panqueca de aveia', 'vegetarian', { calories: 300, protein: 12, carbs: 40, fat: 9, fiber: 5 }),
    dish('bolo', 'Bolo de cenoura', 'vegetarian', { calories: 280, protein: 4, carbs: 40, fat: 11, fiber: 2 }),
  ];
  const goals = { protein: 120, carbs: 230, fat: 60, fiber: 30 };
  const run = (extra: Partial<Parameters<typeof generateWeeklyPlanDetailed>[0]> = {}) =>
    generateWeeklyPlanDetailed({ recipes: catalog, dailyCalories: 2000, goals, allergies: [], preferences: [], seed: 9, foods, ...extra });

  it('não combina coisas estranhas no mesmo prato', () => {
    const { items } = run();
    for (let d = 0; d < 7; d++) {
      for (const meal of ['breakfast', 'lunch', 'snack', 'dinner']) {
        const here = items.filter((i) => i.day === d && i.meal_id === meal);
        const dishes = here.filter((i) => i.recipe_id).map((i) => i.recipe_id);
        const sides = here.filter((i) => i.food).map((i) => i.food!.name);
        if (dishes.includes('risoto')) expect(sides.some((n) => n.startsWith('Arroz'))).toBe(false);
        if (dishes.includes('lasanha')) expect(sides.some((n) => /Frango|Ovo|Iogurte/.test(n))).toBe(false);
        if (dishes.includes('feijoada')) expect(sides.some((n) => n.startsWith('Feijão'))).toBe(false);
        if (dishes.includes('strog')) expect(sides.some((n) => n.startsWith('Frango'))).toBe(false);
        if (dishes.includes('bolo')) expect(sides.every((n) => /Banana|Iogurte/.test(n))).toBe(true);
        // Um de cada tipo por refeição.
        expect(new Set(sides).size).toBe(sides.length);
      }
    }
  });

  it('porção de prato vai até 2 e cada acompanhamento diz por que entrou', () => {
    const { items } = run();
    for (const i of items.filter((x) => x.recipe_id)) expect(i.servings).toBeLessThanOrEqual(2);
    const sides = items.filter((i) => i.food_id);
    expect(sides.length).toBeGreaterThan(0);
    for (const sd of sides) expect(sd.reason?.length).toBeGreaterThan(0);
  });

  it('vegetariano não recebe carne nem frango como acompanhamento', () => {
    const { items } = run({ preferences: ['vegetarian'] });
    expect(items.some((i) => i.food?.name.startsWith('Frango'))).toBe(false);
  });

  it('receita que o paciente pediu para trocar sai do cardápio', () => {
    const many = [...catalog, ...Array.from({ length: 6 }, (_, i) => dish(`x${i}`, `Frango grelhado com legumes ${i}`, 'highProtein', { calories: 380, protein: 35, carbs: 25, fat: 12, fiber: 5 }))];
    const { items } = generateWeeklyPlanDetailed({ recipes: many, dailyCalories: 2000, goals, allergies: [], preferences: [], seed: 9, foods, avoidRecipeIds: ['strog'] });
    expect(items.some((i) => i.recipe_id === 'strog')).toBe(false);
  });

  it('com opções, almoço e jantar podem trazer "escolha 1" com duas receitas', () => {
    const many = [...catalog, ...Array.from({ length: 6 }, (_, i) => dish(`x${i}`, `Frango grelhado com legumes ${i}`, 'highProtein', { calories: 380, protein: 35, carbs: 25, fat: 12, fiber: 5 }))];
    const { items } = generateWeeklyPlanDetailed({ recipes: many, dailyCalories: 2000, goals, allergies: [], preferences: [], seed: 9, foods, alternatives: true });
    const grouped = items.filter((i) => i.option_group !== null);
    expect(grouped.length).toBeGreaterThan(0);
    for (const i of grouped) expect(['lunch', 'dinner']).toContain(i.meal_id);
  });
});
