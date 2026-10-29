// Etapa 4 (20261107120000_recipe_yield.sql): rendimento, porção, base dos nutrientes e ingredientes
// estruturados. Os nomes REC 0x são os critérios do plano.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigration, asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-0000000006a1';
const OTHER = '00000000-0000-4000-8000-0000000006a2';
const PATIENT = '00000000-0000-4000-8000-0000000006a3';
const LEGACY = '00000000-0000-4000-8000-0000000006b1';
const TACO = '00000000-0000-4000-8000-0000000006f1';
const MY_FOOD = '00000000-0000-4000-8000-0000000006f2';
const OTHER_FOOD = '00000000-0000-4000-8000-0000000006f3';
const OP = (n: number) => `00000000-0000-4000-8000-0000000006e${n.toString(16)}`;

let db: PGlite;
let planId: string;

type Facts = Record<string, number | string>;

const FULL = { calories: 1600, protein: 80, carbs: 200, fat: 40, fiber: 16 };

const data = (extra: Record<string, unknown> = {}) => ({
  title: 'Bolo de banana',
  description: '',
  image: '',
  prep_time: 40,
  difficulty: 'easy',
  category: 'dessert',
  instructions: ['Misture', 'Asse'],
  yield_servings: 8,
  serving_label: '1 fatia',
  nutrition_basis: 'whole_recipe',
  nutrition: FULL,
  ...extra,
});

const save = (uid: string, recipe: string | null, d: object, ingredients: object[] = [{ text: '200 g de farinha' }], op: string | null = null) =>
  asUser(db, uid, async (tx) => {
    const r = await tx.query<{ r: { recipe_id: string } }>(`SELECT save_recipe($1, $2::jsonb, $3::jsonb, $4) AS r`, [
      recipe,
      JSON.stringify(d),
      JSON.stringify(ingredients),
      op,
    ]);
    return r.rows[0].r.recipe_id;
  });

const recipe = async (id: string) =>
  (
    await db.query<{
      nutrition_facts: Facts;
      nutrition_declared: Facts;
      nutrition_basis: string;
      nutrition_status: string;
      nutrition_source: string;
      ingredients: string[];
      recipe_version: number;
      yield_servings: string | null;
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
  db = await createTestDb({ until: '20261107120000_recipe_yield.sql' });
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${OTHER}'), ('${PATIENT}');
    INSERT INTO profiles (id, full_name, user_type) VALUES
      ('${NUTRI}', 'Dra. Ana', 'Nutritionist'), ('${OTHER}', 'Dr. Beto', 'Nutritionist'), ('${PATIENT}', 'Carla', 'Client');
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${NUTRI}', '${PATIENT}', 'active');
    -- Receita antiga: valores "por porção" do jeito de antes, com uma chave a mais que ninguém usa.
    INSERT INTO recipes (id, title, author_id, ingredients, nutrition_facts) VALUES
      ('${LEGACY}', 'Omelete', '${NUTRI}', '["2 ovos", "Sal a gosto", ""]',
       '{"calories": 300, "protein": 20, "carbs": 2, "fat": 22, "fiber": 0, "sodium": "x"}');
    INSERT INTO foods (id, taco_id, name, kcal) VALUES ('${TACO}', 9001, 'Farinha de trigo', 360);
    INSERT INTO foods (id, owner_id, name, kcal) VALUES ('${MY_FOOD}', '${NUTRI}', 'Granola da casa', 420),
      ('${OTHER_FOOD}', '${OTHER}', 'Pasta secreta', 500);
  `);
  // Plano publicado e diário com a receita antiga, antes da migração.
  const saved = await asUser(db, NUTRI, (tx) =>
    tx.query<{ r: { plan_id: string } }>(`SELECT save_plan_draft(NULL, $1, 'Semana', '', $2::jsonb, NULL, true, NULL) AS r`, [
      PATIENT,
      JSON.stringify([{ day: 0, meal: 'breakfast', recipe_id: LEGACY, servings: 2, note: '' }]),
    ])
  );
  planId = saved.rows[0].r.plan_id;
  await db.query(
    `INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_id, recipe_title, servings, per_serving)
     VALUES ($1, current_date, $2, 'Omelete', 2, '{"calories": 300}')`,
    [PATIENT, LEGACY]
  );
  await applyMigration(db, '20261107120000_recipe_yield.sql');
}, 60000);

describe('receitas que já existiam', () => {
  it('REC 11: ficam na base antiga, com os mesmos valores (nada é dividido pelo rendimento)', async () => {
    const r = await recipe(LEGACY);
    expect(r.nutrition_basis).toBe('legacy_unit');
    expect(r.nutrition_source).toBe('legacy');
    expect(Number(r.nutrition_facts.calories)).toBe(300);
    expect(r.nutrition_facts.sodium).toBe('x');
    expect(r.nutrition_declared).toEqual({ calories: 300, protein: 20, carbs: 2, fat: 22, fiber: 0 });
    expect(r.nutrition_status).toBe('manual_declared');
  });

  it('as linhas de texto viram ingredientes livres, na ordem, sem as vazias', async () => {
    const rows = (await db.query<{ text: string; food_id: string | null }>(
      `SELECT text, food_id FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY position`, [LEGACY])).rows;
    expect(rows).toEqual([{ text: '2 ovos', food_id: null }, { text: 'Sal a gosto', food_id: null }]);
  });

  it('uma avaliação (que regrava a nota) não mexe nos valores antigos', async () => {
    await asUser(db, PATIENT, (tx) => tx.query(`INSERT INTO reviews (recipe_id, user_id, rating, comment) VALUES ($1, $2, 5, '')`, [LEGACY, PATIENT]));
    const r = await recipe(LEGACY);
    expect(r.nutrition_facts.sodium).toBe('x');
    expect(r.recipe_version).toBe(1);
  });
});

describe('save_recipe', () => {
  it('REC 08: 1600 kcal da receita inteira em 8 porções = 200 kcal por porção', async () => {
    const id = await save(NUTRI, null, data());
    const r = await recipe(id);
    expect(Number(r.nutrition_facts.calories)).toBe(200);
    expect(Number(r.nutrition_facts.fiber)).toBe(2);
    expect(r.nutrition_declared.calories).toBe(1600);
    expect(r.nutrition_status).toBe('manual_declared');
    // Por porção com o mesmo rendimento: o valor fica como foi escrito.
    await save(NUTRI, id, data({ nutrition_basis: 'per_serving', nutrition: { ...FULL, calories: 250 } }));
    expect(Number((await recipe(id)).nutrition_facts.calories)).toBe(250);
  });

  it('REC 07: rendimento zero, negativo, infinito ou inválido é recusado', async () => {
    for (const y of [0, -1, 'Infinity', 'NaN', 'abc', 1001]) {
      expect(await errorOf(save(NUTRI, null, data({ yield_servings: y })))).toContain('invalid_yield');
    }
    expect(await errorOf(save(NUTRI, null, data({ yield_servings: null })))).toContain('invalid_yield');
    // Sem rendimento, valores por porção continuam válidos.
    expect(await errorOf(save(NUTRI, null, data({ yield_servings: null, nutrition_basis: 'per_serving' })))).toBeNull();
  });

  it('REC 03: nutriente não informado fica desconhecido (nunca zero)', async () => {
    const id = await save(NUTRI, null, data({ nutrition: { calories: 800, protein: '' } }));
    const r = await recipe(id);
    expect(r.nutrition_facts).toEqual({ calories: 100 });
    expect(r.nutrition_status).toBe('partial');
    const none = await save(NUTRI, null, data({ nutrition: {} }));
    expect((await recipe(none)).nutrition_status).toBe('unknown');
    expect(await errorOf(save(NUTRI, null, data({ nutrition: { calories: -5 } })))).toContain('validation_failed');
  });

  it('REC 01: ingrediente fora do catálogo é salvo como texto; alimento só da TACO ou do próprio autor', async () => {
    const id = await save(NUTRI, null, data(), [
      { text: 'Fermento caseiro da vovó', note: 'opcional' },
      { text: '200 g de farinha', food_id: TACO, quantity: 200, unit: 'g' },
      { text: '1 xícara de granola', food_id: MY_FOOD, quantity: 1, unit: 'xícara' },
    ]);
    const rows = (await db.query<{ text: string; food_id: string | null; quantity: string | null; note: string }>(
      `SELECT text, food_id, quantity, note FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY position`, [id])).rows;
    expect(rows.map((r) => [r.text, r.food_id, r.quantity === null ? null : Number(r.quantity), r.note])).toEqual([
      ['Fermento caseiro da vovó', null, null, 'opcional'],
      ['200 g de farinha', TACO, 200, ''],
      ['1 xícara de granola', MY_FOOD, 1, ''],
    ]);
    // O formato antigo (linhas de texto) acompanha.
    expect((await recipe(id)).ingredients).toEqual(['Fermento caseiro da vovó', '200 g de farinha', '1 xícara de granola']);
    expect(await errorOf(save(NUTRI, null, data(), [{ text: 'pasta', food_id: OTHER_FOOD }]))).toContain('not_allowed');
    expect(await errorOf(save(NUTRI, null, data(), [{ text: '   ' }]))).toContain('validation_failed');
  });

  it('REC 10: quem lê a receita vê o texto do ingrediente, não o alimento privado', async () => {
    const id = await save(NUTRI, null, data(), [{ text: 'Granola da casa', food_id: MY_FOOD }]);
    const seen = await asUser(db, OTHER, async (tx) => ({
      lines: (await tx.query<{ text: string }>(`SELECT text FROM recipe_ingredients WHERE recipe_id = $1`, [id])).rows,
      food: (await tx.query(`SELECT 1 FROM foods WHERE id = $1`, [MY_FOOD])).rows,
    }));
    expect(seen.lines).toEqual([{ text: 'Granola da casa' }]);
    expect(seen.food).toHaveLength(0);
    // Receita oculta: as linhas somem junto para quem não é o autor.
    await db.query(`UPDATE recipes SET hidden_at = now() WHERE id = $1`, [id]);
    const hidden = await asUser(db, OTHER, (tx) => tx.query(`SELECT 1 FROM recipe_ingredients WHERE recipe_id = $1`, [id]));
    expect(hidden.rows).toHaveLength(0);
  });

  it('só o autor altera; a base antiga não serve para receita nova; o mesmo pedido não cria duas', async () => {
    const id = await save(NUTRI, null, data());
    expect(await errorOf(save(OTHER, id, data()))).toContain('not_allowed');
    expect(await errorOf(save(NUTRI, null, data({ nutrition_basis: 'legacy_unit' })))).toContain('validation_failed');
    // A receita antiga pode continuar na base antiga ao ser editada.
    await save(NUTRI, LEGACY, data({ title: 'Omelete', nutrition_basis: 'legacy_unit', nutrition: { calories: 300 } }), [{ text: '2 ovos' }]);
    expect((await recipe(LEGACY)).nutrition_basis).toBe('legacy_unit');

    const before = (await db.query(`SELECT 1 FROM recipes`)).rows.length;
    const a = await save(NUTRI, null, data(), undefined, OP(1));
    const b = await save(NUTRI, null, data(), undefined, OP(1));
    expect(a).toBe(b);
    expect((await db.query(`SELECT 1 FROM recipes`)).rows.length).toBe(before + 1);
  });

  it('a versão da receita sobe quando rendimento, ingredientes ou nutrientes mudam', async () => {
    const id = await save(NUTRI, null, data());
    expect((await recipe(id)).recipe_version).toBe(1);
    await save(NUTRI, id, data({ yield_servings: 10 }));
    expect((await recipe(id)).recipe_version).toBe(2);
    await save(NUTRI, id, data({ yield_servings: 10, description: 'outra descrição' }));
    expect((await recipe(id)).recipe_version).toBe(2);
  });
});

describe('o que já foi registrado não muda', () => {
  it('REC 04: mudar o rendimento não altera o diário nem a versão publicada do plano', async () => {
    const id = await save(NUTRI, null, data());
    const rev = (await db.query<{ revision: number }>(`SELECT revision FROM meal_plans WHERE id = $1`, [planId])).rows[0].revision;
    const meal = (await db.query<{ id: string }>(`SELECT id FROM meal_plan_meals WHERE plan_id = $1 LIMIT 1`, [planId])).rows[0].id;
    await asUser(db, NUTRI, (tx) =>
      tx.query(`SELECT save_plan_draft($1, $2, 'Semana', '', $3::jsonb, $4, true, NULL, $5::jsonb)`, [
        planId,
        PATIENT,
        JSON.stringify([{ day: 0, meal_id: meal, recipe_id: id, servings: 2, note: '' }]),
        rev,
        JSON.stringify([{ id: meal, name: 'Café da manhã', category: 'breakfast', days: [0, 1, 2, 3, 4, 5, 6] }]),
      ])
    );
    const snap = async () =>
      (await db.query<{ c: { recipes: Record<string, { nutrition_facts: Facts; yield_servings: number; nutrition_basis: string }> } }>(
        `SELECT content AS c FROM meal_plan_versions WHERE plan_id = $1 ORDER BY number DESC LIMIT 1`, [planId])).rows[0].c.recipes[id];
    expect(Number((await snap()).nutrition_facts.calories)).toBe(200);
    expect((await snap()).yield_servings).toBe(8);
    expect((await snap()).nutrition_basis).toBe('whole_recipe');

    await save(NUTRI, id, data({ yield_servings: 4 }));
    expect(Number((await recipe(id)).nutrition_facts.calories)).toBe(400);
    expect(Number((await snap()).nutrition_facts.calories)).toBe(200);
    const diary = (await db.query<{ per_serving: Facts }>(`SELECT per_serving FROM nutrition_log_entries WHERE user_id = $1`, [PATIENT])).rows;
    expect(diary.map((d) => d.per_serving)).toEqual([{ calories: 300 }]);
  });
});

describe('app antigo (grava direto na tabela)', () => {
  it('valores mandados pelo app antigo são por porção; linhas de texto viram ingredientes livres', async () => {
    const id = await save(NUTRI, null, data(), [{ text: '200 g de farinha', food_id: TACO }]);
    await asUser(db, NUTRI, (tx) =>
      tx.query(`UPDATE recipes SET nutrition_facts = $2::jsonb, ingredients = $3::jsonb WHERE id = $1`, [
        id,
        JSON.stringify({ calories: 210, protein: 10, carbs: 25, fat: 5, fiber: 2 }),
        JSON.stringify(['300 g de farinha', 'Canela']),
      ])
    );
    const r = await recipe(id);
    expect(r.nutrition_basis).toBe('per_serving');
    expect(Number(r.nutrition_facts.calories)).toBe(210);
    const rows = (await db.query<{ text: string; food_id: string | null }>(
      `SELECT text, food_id FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY position`, [id])).rows;
    expect(rows).toEqual([{ text: '300 g de farinha', food_id: null }, { text: 'Canela', food_id: null }]);
  });

  it('o app antigo não grava os campos novos direto', async () => {
    const id = await save(NUTRI, null, data());
    expect(await errorOf(asUser(db, NUTRI, (tx) => tx.query(`UPDATE recipes SET yield_servings = 0 WHERE id = $1`, [id])))).toContain('permission denied');
    expect(await errorOf(asUser(db, NUTRI, (tx) => tx.query(`INSERT INTO recipe_ingredients (recipe_id, position, text) VALUES ($1, 9, 'x')`, [id])))).toContain('permission denied');
  });

  it('app_min_client sobe para 4 ou mais', async () => {
    expect((await db.query<{ v: number }>(`SELECT app_min_client() AS v`)).rows[0].v).toBeGreaterThanOrEqual(4);
  });
});
