import { describe, expect, it } from 'vitest';
import {
  calcFromIngredients,
  declaredStatus,
  hasUsableNutrition,
  ingredientFactor,
  nutritionDraftFrom,
  parseAmount,
  perServing,
  readNutritionDraft,
  ingredientSignature,
  suggestGrams,
} from '../recipe-nutrition';
import { buildShoppingItems } from '../ingredients';
import { generateWeeklyPlanDetailed } from '../meal-plan-generator';
import { defaultMeals } from '../plan-meals';
import type { Recipe, RecipeIngredient } from '../../types/recipe';

const draft = (extra: Partial<ReturnType<typeof nutritionDraftFrom>> = {}) => ({ ...nutritionDraftFrom({ nutritionDeclared: {} }), ...extra });

describe('rendimento e porção', () => {
  it('REC 08: 1600 kcal da receita inteira em 8 porções = 200 por porção; 2 porções = 400', () => {
    const one = perServing({ calories: 1600, protein: 80 }, 'whole_recipe', 8);
    expect(one).toEqual({ calories: 200, protein: 10 });
    expect(one.calories! * 2).toBe(400);
    // Por porção ou receita antiga: o valor como foi escrito, mesmo com rendimento.
    expect(perServing({ calories: 300 }, 'per_serving', 8)).toEqual({ calories: 300 });
    expect(perServing({ calories: 300 }, 'legacy_unit', 8)).toEqual({ calories: 300 });
  });

  it('REC 03: nutriente não informado continua desconhecido', () => {
    expect(perServing({ calories: 800 }, 'whole_recipe', 4)).toEqual({ calories: 200 });
    expect(declaredStatus({ calories: 1 })).toBe('partial');
    expect(declaredStatus({})).toBe('unknown');
    expect(declaredStatus({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })).toBe('manual_declared');
  });

  it('REC 06: vírgula, ponto, fração e número misto são lidos do mesmo jeito', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('1.5')).toBe(1.5);
    expect(parseAmount('1/2')).toBe(0.5);
    expect(parseAmount('1 1/2')).toBe(1.5);
    expect(parseAmount('½')).toBe(0.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNaN();
  });

  it('REC 07: rendimento zero, negativo, infinito ou inválido é recusado na tela', () => {
    for (const y of ['0', '-1', 'Infinity', 'abc', '1001', '1/0']) {
      expect(readNutritionDraft(draft({ yieldServings: y }))).toMatchObject({ ok: false, error: 'invalidYield' });
    }
    expect(readNutritionDraft(draft({ basis: 'whole_recipe' }))).toMatchObject({ ok: false, error: 'wholeNeedsYield' });
    expect(readNutritionDraft(draft({ values: { calories: '-5', protein: '', carbs: '', fat: '', fiber: '' } }))).toMatchObject({
      ok: false,
      field: 'calories',
    });
    const ok = readNutritionDraft(draft({ yieldServings: '8', basis: 'whole_recipe', values: { calories: '1600', protein: '', carbs: '', fat: '', fiber: '' } }));
    expect(ok).toMatchObject({ ok: true, value: { yieldServings: 8, nutritionDeclared: { calories: 1600 } } });
  });

  it('receita vinda do cartão (sem o declarado) abre por porção, com os desconhecidos em branco', () => {
    const d = nutritionDraftFrom({
      nutritionBasis: 'whole_recipe',
      yieldServings: 8,
      nutritionFacts: { calories: 200, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      unknownNutrients: ['protein'],
    });
    expect(d.basis).toBe('per_serving');
    expect(d.values.calories).toBe('200');
    expect(d.values.protein).toBe('');
  });
});

describe('REC 12: mesmo fator de escala na lista de compras', () => {
  it('200 g de farinha em 8 porções: 2 porções usam 50 g; receita antiga segue a regra de antes', () => {
    const factor = ingredientFactor({ yieldServings: 8, nutritionBasis: 'whole_recipe' }, 2);
    expect(factor).toBe(0.25);
    expect(buildShoppingItems([{ title: 'Bolo', ingredients: ['200 g de farinha'], factor }])[0].quantity).toBe('50 g');
    expect(ingredientFactor({ yieldServings: 8, nutritionBasis: 'legacy_unit' }, 2)).toBe(2);
    expect(ingredientFactor({ yieldServings: null, nutritionBasis: 'per_serving' }, 2)).toBe(2);
  });
});

describe('ajuste automático', () => {
  it('receita com valores incompletos fica fora do gerador', () => {
    const recipe = (id: string, status: Recipe['nutritionStatus']) =>
      ({
        id, title: id, description: '', image: '', prepTime: 10, difficulty: 'easy', rating: 4, reviewCount: 0, category: 'vegetarian',
        ingredients: ['arroz'], instructions: [], nutritionFacts: { calories: 400, protein: 10, carbs: 40, fat: 5, fiber: 3 },
        reviews: [], authorId: 'a', createdAt: '', updatedAt: '', nutritionStatus: status,
      }) as Recipe;
    const recipes = [recipe('ok', 'manual_declared'), recipe('legacy', undefined), recipe('partial', 'partial'), recipe('none', 'unknown')];
    expect(recipes.filter(hasUsableNutrition).map((r) => r.id)).toEqual(['ok', 'legacy']);
    const names = { breakfast: 'Café', lunch: 'Almoço', snack: 'Lanche', dinner: 'Jantar' };
    const { items } = generateWeeklyPlanDetailed({ recipes, dailyCalories: 2000, allergies: [], preferences: [], meals: defaultMeals(names), seed: 3 });
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((i) => i.recipe_id))).toEqual(new Set(['ok', 'legacy']));
  });
});

describe('REC B: cálculo pelos ingredientes', () => {
  const flour = { kcal: 360, protein: 10, carbs: 75, fat: 1.4, fiber: 2.3, measures: [{ label: 'xícara (chá)', grams: 120 }] };
  const milk = { kcal: 60, protein: 3, carbs: 4.5, fat: 3.2, fiber: 0, measures: [] };
  const foods = new Map([['flour', flour], ['milk', milk]]);
  const row = (text: string, extra: Partial<RecipeIngredient> = {}): RecipeIngredient => ({ text, foodId: null, quantity: null, unit: null, note: '', ...extra });

  it('mesma conta do banco: 400 g de farinha + 400 g de leite = 1680 kcal; ÷ 4 porções = 420', () => {
    const calc = calcFromIngredients([row('400 g de farinha', { foodId: 'flour', grams: 400 }), row('leite', { foodId: 'milk', grams: 400 })], foods);
    expect(calc.status).toBe('complete');
    expect(calc.total.calories).toBe(1680);
    expect(perServing(calc.total, 'whole_recipe', 4).calories).toBe(420);
  });

  it('linha sem alimento ou sem gramas fica pendente; "não entra no cálculo" é decisão explícita', () => {
    const rows = [row('farinha', { foodId: 'flour', grams: 100 }), row('1 ovo'), row('leite', { foodId: 'milk' }), row('Sal a gosto', { excluded: true })];
    const calc = calcFromIngredients(rows, foods);
    expect(calc.status).toBe('partial');
    expect(calc.issues).toEqual([{ index: 1, issue: 'no_food' }, { index: 2, issue: 'no_grams' }]);
    expect(calc.total.calories).toBe(360);
    expect(calcFromIngredients([row('Sal a gosto')], foods)).toMatchObject({ status: 'unknown', total: {} });
  });

  it('gramas: g e kg direto; medida caseira só pela medida do alimento; ml nunca vira g', () => {
    expect(suggestGrams('200 g de farinha', flour)).toEqual({ grams: 200, measureLabel: null });
    expect(suggestGrams('0,5 kg de farinha', flour)).toEqual({ grams: 500, measureLabel: null });
    expect(suggestGrams('2 xícaras de farinha', flour)).toEqual({ grams: 240, measureLabel: 'xícara (chá)' });
    expect(suggestGrams('2 xícaras de leite', milk)).toBeNull();
    expect(suggestGrams('200 ml de leite', milk)).toBeNull();
    expect(suggestGrams('Sal a gosto', flour)).toBeNull();
  });

  it('calculado exige rendimento; valores à mão em revisão saem do ajuste automático', () => {
    expect(readNutritionDraft(draft({ source: 'ingredients' }))).toMatchObject({ ok: false, error: 'calcNeedsYield' });
    expect(readNutritionDraft(draft({ source: 'ingredients', yieldServings: '4' }))).toMatchObject({
      ok: true,
      value: { nutritionSource: 'ingredients', nutritionBasis: 'whole_recipe', nutritionDeclared: {} },
    });
    expect(hasUsableNutrition({ nutritionStatus: 'manual_declared', nutritionNeedsReview: true })).toBe(false);
    expect(hasUsableNutrition({ nutritionStatus: 'complete' })).toBe(true);
  });

  it('REC 09: mudar ingrediente muda a assinatura; mudar a observação não', () => {
    const a = [row('200 g de farinha', { foodId: 'flour', grams: 200 })];
    expect(ingredientSignature(a)).not.toBe(ingredientSignature([{ ...a[0], grams: 250 }]));
    expect(ingredientSignature(a)).toBe(ingredientSignature([{ ...a[0], note: 'peneirada' }]));
  });
});
