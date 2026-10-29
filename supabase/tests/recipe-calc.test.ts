// Etapa 5 (20261108120000_recipe_calc.sql): valores da receita calculados pelos ingredientes.
// Os nomes REC 0x são os critérios do plano.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-0000000007a1';
const READER = '00000000-0000-4000-8000-0000000007a2';
const FLOUR = '00000000-0000-4000-8000-0000000007f1';
const MILK = '00000000-0000-4000-8000-0000000007f2';
const MINE = '00000000-0000-4000-8000-0000000007f3';

let db: PGlite;

type Facts = Record<string, number | string>;

const base = (extra: Record<string, unknown> = {}) => ({
  title: 'Panqueca',
  description: '',
  image: '',
  prep_time: 20,
  difficulty: 'easy',
  category: 'breakfast',
  instructions: ['Misture'],
  yield_servings: 4,
  serving_label: '1 panqueca',
  nutrition_source: 'ingredients',
  ...extra,
});

// 400 g de farinha (360 kcal/100 g) + 400 g de leite (60 kcal/100 g) = 1440 + 240 = 1680 kcal.
const FULL_ROWS = [
  { text: '400 g de farinha', food_id: FLOUR, grams: 400 },
  { text: '2 copos de leite', food_id: MILK, grams: 400, measure_label: 'copo' },
];

const save = (recipe: string | null, d: object, ingredients: object[] = FULL_ROWS) =>
  asUser(db, NUTRI, async (tx) => {
    const r = await tx.query<{ r: { recipe_id: string; status: string; missing: number } }>(
      `SELECT save_recipe($1, $2::jsonb, $3::jsonb, NULL) AS r`,
      [recipe, JSON.stringify(d), JSON.stringify(ingredients)]
    );
    return r.rows[0].r;
  });

const recipe = async (id: string) =>
  (
    await db.query<{
      nutrition_facts: Facts;
      nutrition_declared: Facts;
      nutrition_basis: string;
      nutrition_source: string;
      nutrition_status: string;
      nutrition_needs_review: boolean;
      recipe_version: number;
    }>(`SELECT * FROM recipes WHERE id = $1`, [id])
  ).rows[0];

const errorOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${READER}');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${NUTRI}', 'Dra. Ana', 'Nutritionist'), ('${READER}', 'Leo', 'Client');
    INSERT INTO foods (id, taco_id, name, kcal, protein, carbs, fat, fiber) VALUES
      ('${FLOUR}', 7001, 'Farinha de trigo', 360, 10, 75, 1.4, 2.3),
      ('${MILK}', 7002, 'Leite integral', 60, 3, 4.5, 3.2, 0);
    INSERT INTO foods (id, owner_id, name, kcal) VALUES ('${MINE}', '${NUTRI}', 'Granola da casa', 420);
  `);
}, 60000);

describe('cálculo pelos ingredientes', () => {
  it('soma por 100 g × gramas e divide pelo rendimento (1680 kcal ÷ 4 = 420)', async () => {
    const r = await save(null, base());
    expect(r.status).toBe('complete');
    const row = await recipe(r.recipe_id);
    expect(row.nutrition_source).toBe('ingredients');
    expect(row.nutrition_basis).toBe('whole_recipe');
    expect(Number(row.nutrition_declared.calories)).toBe(1680);
    expect(Number(row.nutrition_facts.calories)).toBe(420);
    expect(Number(row.nutrition_facts.protein)).toBe(13);
    // Cada linha guarda o que somou: o total é reproduzível.
    const lines = (await db.query<{ line_nutrients: Facts }>(
      `SELECT line_nutrients FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY position`, [r.recipe_id])).rows;
    expect(lines.map((l) => Number(l.line_nutrients.calories))).toEqual([1440, 240]);
  });

  it('REC 03: linha sem alimento ou sem gramas deixa parcial e não vira zero', async () => {
    const r = await save(null, base(), [...FULL_ROWS, { text: '1 ovo' }, { text: 'Granola', food_id: MINE }]);
    expect(r).toMatchObject({ status: 'partial', missing: 2 });
    expect(Number((await recipe(r.recipe_id)).nutrition_declared.calories)).toBe(1680);
    // Nada contável: desconhecido, sem valores.
    const none = await save(null, base(), [{ text: 'Sal a gosto' }]);
    expect(none.status).toBe('unknown');
    expect((await recipe(none.recipe_id)).nutrition_facts).toEqual({});
  });

  it('"a gosto" só deixa de bloquear com a decisão explícita de não contar', async () => {
    const r = await save(null, base(), [...FULL_ROWS, { text: 'Sal a gosto', excluded: true }]);
    expect(r.status).toBe('complete');
  });

  it('calculado exige rendimento; gramas inválidos são recusados', async () => {
    expect(await errorOf(save(null, base({ yield_servings: null })))).toContain('invalid_yield');
    expect(await errorOf(save(null, base(), [{ text: 'x', food_id: FLOUR, grams: -1 }]))).toContain('validation_failed');
  });

  it('REC 05: valores à mão substituem o cálculo (não somam)', async () => {
    const r = await save(null, base());
    await save(r.recipe_id, base({ nutrition_source: 'manual', nutrition_basis: 'per_serving', nutrition: { calories: 300, protein: 1, carbs: 1, fat: 1, fiber: 1 } }));
    const row = await recipe(r.recipe_id);
    expect(row.nutrition_source).toBe('manual');
    expect(Number(row.nutrition_facts.calories)).toBe(300);
    expect(row.nutrition_status).toBe('manual_declared');
  });

  it('REC 09: mudar ingrediente invalida a revisão manual, até o autor confirmar', async () => {
    const manual = base({ nutrition_source: 'manual', nutrition_basis: 'per_serving', nutrition: { calories: 300, protein: 1, carbs: 1, fat: 1, fiber: 1 } });
    const r = await save(null, manual);
    expect((await recipe(r.recipe_id)).nutrition_needs_review).toBe(false);
    await save(r.recipe_id, manual, [{ text: '500 g de farinha', food_id: FLOUR, grams: 500 }]);
    expect((await recipe(r.recipe_id)).nutrition_needs_review).toBe(true);
    // Salvar de novo sem confirmar continua pendente; confirmar limpa.
    await save(r.recipe_id, manual, [{ text: '500 g de farinha', food_id: FLOUR, grams: 500 }]);
    expect((await recipe(r.recipe_id)).nutrition_needs_review).toBe(true);
    await save(r.recipe_id, { ...manual, confirm_manual: true }, [{ text: '500 g de farinha', food_id: FLOUR, grams: 500 }]);
    expect((await recipe(r.recipe_id)).nutrition_needs_review).toBe(false);
    // Mudar o rendimento também invalida; mudar os próprios valores conta como revisão.
    await save(r.recipe_id, { ...manual, yield_servings: 6 }, [{ text: '500 g de farinha', food_id: FLOUR, grams: 500 }]);
    expect((await recipe(r.recipe_id)).nutrition_needs_review).toBe(true);
    await save(r.recipe_id, { ...manual, yield_servings: 6, nutrition: { calories: 280, protein: 1, carbs: 1, fat: 1, fiber: 1 } }, [
      { text: '500 g de farinha', food_id: FLOUR, grams: 500 },
    ]);
    expect((await recipe(r.recipe_id)).nutrition_needs_review).toBe(false);
  });

  it('alimento alterado ou apagado depois não muda os valores salvos da receita', async () => {
    const r = await save(null, base(), [{ text: 'Granola', food_id: MINE, grams: 100 }]);
    expect(Number((await recipe(r.recipe_id)).nutrition_declared.calories)).toBe(420);
    await asUser(db, NUTRI, (tx) => tx.query(`UPDATE foods SET kcal = 500 WHERE id = $1`, [MINE]));
    expect(Number((await recipe(r.recipe_id)).nutrition_declared.calories)).toBe(420);
    await asUser(db, NUTRI, (tx) => tx.query(`DELETE FROM foods WHERE id = $1`, [MINE]));
    const row = await recipe(r.recipe_id);
    expect(Number(row.nutrition_declared.calories)).toBe(420);
    const line = (await db.query<{ food_id: string | null; line_nutrients: Facts; text: string }>(
      `SELECT food_id, line_nutrients, text FROM recipe_ingredients WHERE recipe_id = $1`, [r.recipe_id])).rows[0];
    expect(line).toMatchObject({ food_id: null, text: 'Granola' });
    expect(Number(line.line_nutrients.calories)).toBe(420);
  });

  it('receita nova começa na versão 1', async () => {
    const r = await save(null, base());
    expect((await recipe(r.recipe_id)).recipe_version).toBe(1);
  });

  it('app antigo que grava valores numa receita calculada: passam a ser valores à mão por porção', async () => {
    const r = await save(null, base());
    await asUser(db, NUTRI, (tx) =>
      tx.query(`UPDATE recipes SET nutrition_facts = '{"calories": 410, "protein": 1, "carbs": 1, "fat": 1, "fiber": 1}' WHERE id = $1`, [r.recipe_id])
    );
    const row = await recipe(r.recipe_id);
    expect(row).toMatchObject({ nutrition_source: 'manual', nutrition_basis: 'per_serving', nutrition_status: 'manual_declared' });
    expect(Number(row.nutrition_facts.calories)).toBe(410);
  });

  it('quem lê a receita vê os gramas, mas não consegue ler o alimento privado', async () => {
    await db.exec(`INSERT INTO foods (id, owner_id, name, kcal) VALUES ('${MINE}', '${NUTRI}', 'Granola da casa', 420)`);
    const r = await save(null, base(), [{ text: 'Granola', food_id: MINE, grams: 100 }]);
    const seen = await asUser(db, READER, async (tx) => ({
      line: (await tx.query<{ grams: string }>(`SELECT grams FROM recipe_ingredients WHERE recipe_id = $1`, [r.recipe_id])).rows,
      food: (await tx.query(`SELECT 1 FROM foods WHERE id = $1`, [MINE])).rows,
    }));
    expect(seen.line.map((l) => Number(l.grams))).toEqual([100]);
    expect(seen.food).toHaveLength(0);
  });

  it('app_min_client sobe para 5', async () => {
    expect((await db.query<{ v: number }>(`SELECT app_min_client() AS v`)).rows[0].v).toBe(5);
  });
});
