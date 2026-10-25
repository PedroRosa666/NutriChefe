// Etapa 3 (20261106120000_custom_meals.sql): refeições personalizadas com id próprio, "Comi" por
// bloco, trocas pelo item e compatibilidade com o app antigo. Os nomes REF 0x são os critérios do plano.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-0000000003a1';
const PATIENT = '00000000-0000-4000-8000-0000000003a3';
const RECIPE = '00000000-0000-4000-8000-0000000003b1';
const RECIPE_2 = '00000000-0000-4000-8000-0000000003b2';
const RECIPE_3 = '00000000-0000-4000-8000-0000000003b3';

const MEAL = (n: number) => `00000000-0000-4000-8000-0000000003c${n.toString(16)}`;
const ITEM = (n: number) => `00000000-0000-4000-8000-0000000004${n.toString(16).padStart(2, '0')}`;
const OP = (n: number) => `00000000-0000-4000-8000-0000000003e${n.toString(16)}`;

let db: PGlite;
let today: string;
let todayDay: number;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

interface Meal {
  id: string;
  name: string;
  category?: string | null;
  days?: number[];
  time?: string | null;
  guidance?: string;
}

const meal = (n: number, name: string, extra: Partial<Meal> = {}): Meal => ({ id: MEAL(n), name, category: null, days: ALL_DAYS, ...extra });

const item = (id: string | null, mealId: string, day: number, recipe = RECIPE, group: number | null = null) => ({
  id,
  day,
  meal_id: mealId,
  recipe_id: recipe,
  servings: 1,
  option_group: group,
  note: '',
});

interface SaveResult {
  plan_id: string;
  revision: number;
  version: { version_id: string; number: number; valid_from: string } | null;
}

const save = (args: { plan?: string | null; meals: Meal[] | null; items: object[]; publish?: boolean; uid?: string }) =>
  asUser(db, args.uid ?? NUTRI, async (tx) =>
    (
      await tx.query<{ r: SaveResult }>(`SELECT save_plan_draft($1, $2, 'Semana', '', $3::jsonb, NULL, $4, NULL, $5::jsonb) AS r`, [
        args.plan ?? null,
        PATIENT,
        JSON.stringify(args.items),
        args.publish ?? true,
        args.meals ? JSON.stringify(args.meals) : null,
      ])
    ).rows[0].r
  );

const currentContent = async (planId: string) =>
  (
    await db.query<{ content: { format: number; meals: (Meal & { days: number[] })[]; items: { id: string; meal_id: string; day: number }[] } }>(
      `SELECT content FROM meal_plan_versions WHERE id = plan_version_on($1, app_today())`,
      [planId]
    )
  ).rows[0].content;

const entry = (itemId: string, title = 'Item') => ({
  item_id: itemId,
  title,
  servings: 1,
  per_serving: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 },
});

const check = (planId: string, mealId: string, status: string, items: object[] = [], op: string | null = null) =>
  asUser(db, PATIENT, async (tx) =>
    (
      await tx.query<{ r: { id: string; meal_id: string; meal_name: string } }>(
        `SELECT record_meal_check($1, app_today(), $2, $3, $4::jsonb, '', $5) AS r`,
        [planId, mealId, status, JSON.stringify(items), op]
      )
    ).rows[0].r
  );

const diary = () =>
  db
    .query<{ recipe_title: string; meal_id: string | null; meal_name: string | null }>(
      `SELECT recipe_title, meal_id, meal_name FROM nutrition_log_entries WHERE user_id = $1 ORDER BY recipe_title`,
      [PATIENT]
    )
    .then((r) => r.rows);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${PATIENT}');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${NUTRI}', 'Dra. Ana', 'Nutritionist'), ('${PATIENT}', 'Carla', 'Client');
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${NUTRI}', '${PATIENT}', 'active');
    INSERT INTO recipes (id, title, nutrition_facts) VALUES
      ('${RECIPE}', 'Omelete', '{"calories": 300}'), ('${RECIPE_2}', 'Tapioca', '{"calories": 250}'), ('${RECIPE_3}', 'Iogurte', '{"calories": 120}');
  `);
  today = (await db.query<{ d: string }>(`SELECT app_today()::text AS d`)).rows[0].d;
  todayDay = (await db.query<{ d: number }>(`SELECT plan_day_of(app_today()) AS d`)).rows[0].d;
}, 60000);

describe('blocos de refeição', () => {
  let planId: string;
  const sixMeals = () => [
    meal(1, 'Café da manhã', { category: 'breakfast', time: '07:00' }),
    meal(2, 'Lanche', { category: 'snack', time: '10:00' }),
    meal(3, 'Almoço', { category: 'lunch' }),
    meal(4, 'Lanche', { category: 'snack', time: '16:00' }),
    meal(5, 'Pré-treino', { guidance: 'Uma hora antes do treino.' }),
    meal(6, 'Ceia'),
  ];

  it('REF 01: seis refeições, com dois "Lanche", voltam na mesma ordem e com as mesmas quantidades', async () => {
    const items = [1, 2, 3, 4, 5, 6].map((n) => item(ITEM(n), MEAL(n), todayDay));
    const r = await save({ meals: sixMeals(), items });
    planId = r.plan_id;
    const stored = await db.query<{ name: string; time_of_day: string | null }>(
      `SELECT name, time_of_day FROM meal_plan_meals WHERE plan_id = $1 ORDER BY position`,
      [planId]
    );
    expect(stored.rows.map((m) => m.name)).toEqual(['Café da manhã', 'Lanche', 'Almoço', 'Lanche', 'Pré-treino', 'Ceia']);
    const content = await currentContent(planId);
    expect(content.format).toBe(2);
    expect(content.meals.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6].map(MEAL));
    expect(content.items.map((i) => i.meal_id)).toEqual([1, 2, 3, 4, 5, 6].map(MEAL));
    // Bloco só aparece nos dias em que tem itens.
    expect(content.meals[0].days).toEqual([todayDay]);
  });

  it('REF 05/06: "Comi", desmarcar e "Comi" de novo dão um conjunto só; repetir a operação não duplica', async () => {
    await check(planId, MEAL(2), 'ate', [entry(ITEM(2), 'Lanche 1')], OP(1));
    await check(planId, MEAL(2), 'ate', [entry(ITEM(2), 'Lanche 1')], OP(1));
    await check(planId, MEAL(4), 'ate', [entry(ITEM(4), 'Lanche 2')]);
    // Dois "Lanche" no mesmo dia são marcações diferentes.
    expect((await diary()).map((e) => [e.recipe_title, e.meal_id])).toEqual([
      ['Lanche 1', MEAL(2)],
      ['Lanche 2', MEAL(4)],
    ]);
    await asUser(db, PATIENT, (tx) => tx.query(`DELETE FROM meal_plan_checks WHERE plan_id = $1 AND meal_id = $2`, [planId, MEAL(2)]));
    await check(planId, MEAL(2), 'ate', [entry(ITEM(2), 'Lanche 1')]);
    expect((await diary()).map((e) => e.recipe_title)).toEqual(['Lanche 1', 'Lanche 2']);
    expect((await diary())[0].meal_name).toBe('Lanche');
  });

  it('"Comi" exige os itens fixos e uma opção por grupo, pelo id do item', async () => {
    // Bloco de outro dia, item de outro bloco e bloco fora da versão: recusados.
    await expect(check(planId, MEAL(1), 'ate', [entry(ITEM(2))])).rejects.toThrow(/validation_failed/);
    await expect(check(planId, MEAL(1), 'ate', [])).rejects.toThrow(/validation_failed/);
    await expect(check(planId, MEAL(15), 'skipped')).rejects.toThrow(/validation_failed/);
  });

  it('REF 02: renomear e reordenar não leva marcações nem trocas para outro bloco', async () => {
    const meals = sixMeals().reverse().map((m) => (m.id === MEAL(2) ? { ...m, name: 'Lanche da manhã' } : m));
    await save({ plan: planId, meals, items: [1, 2, 3, 4, 5, 6].map((n) => item(ITEM(n), MEAL(n), todayDay)) });
    const checks = await db.query<{ meal_id: string; meal_name: string }>(
      `SELECT meal_id, meal_name FROM meal_plan_checks WHERE plan_id = $1 ORDER BY meal_name, meal_id`,
      [planId]
    );
    expect(checks.rows.map((c) => c.meal_id).sort()).toEqual([MEAL(2), MEAL(4)]);
    // O nome guardado na marcação é o de quando ela foi feita.
    expect(checks.rows.every((c) => c.meal_name === 'Lanche')).toBe(true);
  });

  it('REF 12: remover um bloco não apaga marcação nem consumo passados', async () => {
    const before = await diary();
    await save({ plan: planId, meals: sixMeals().filter((m) => m.id !== MEAL(2)), items: [1, 3, 4, 5, 6].map((n) => item(ITEM(n), MEAL(n), todayDay)) });
    expect(await diary()).toEqual(before);
    expect((await db.query(`SELECT 1 FROM meal_plan_meals WHERE id = $1`, [MEAL(2)])).rows).toHaveLength(0);
  });

  it('item em bloco de outro plano, ou em dia em que o bloco não aparece, é recusado', async () => {
    const other = await save({ meals: [meal(9, 'Outro')], items: [item(null, MEAL(9), 0)], publish: false });
    await expect(save({ plan: planId, meals: [...sixMeals(), meal(9, 'Outro')], items: [] })).rejects.toThrow(/validation_failed/);
    await expect(save({ plan: planId, meals: [meal(1, 'Café', { days: [0] })], items: [item(null, MEAL(1), 3)] })).rejects.toThrow(
      /validation_failed/
    );
    await db.query(`DELETE FROM meal_plans WHERE id = $1`, [other.plan_id]);
  });

  it('REF 13 e limites: mais de 30 itens numa refeição ou mais de 12 refeições num dia são recusados por inteiro', async () => {
    const tooMany = Array.from({ length: 31 }, () => item(null, MEAL(1), 0));
    await expect(save({ plan: planId, meals: [meal(1, 'Café')], items: tooMany })).rejects.toThrow(/limit_exceeded/);
    const thirteen = Array.from({ length: 13 }, (_, i) => meal(i + 1, `R${i}`));
    await expect(save({ plan: planId, meals: thirteen, items: [] })).rejects.toThrow(/limit_exceeded/);
    // Nada foi gravado: o plano continua com os blocos de antes.
    expect((await db.query(`SELECT 1 FROM meal_plan_meals WHERE plan_id = $1`, [planId])).rows).toHaveLength(5);
  });
});

describe('app antigo (só as quatro refeições)', () => {
  it('REF 07: plano salvo pelo código das refeições vira quatro blocos com os mesmos itens', async () => {
    const legacy = [
      { day: 0, meal: 'breakfast', recipe_id: RECIPE, servings: 1, note: '' },
      { day: 0, meal: 'lunch', recipe_id: RECIPE_2, servings: 2, note: '' },
      { day: 1, meal: 'breakfast', recipe_id: RECIPE_3, servings: 1, note: '' },
    ];
    const r = await save({ meals: null, items: legacy });
    const content = await currentContent(r.plan_id);
    expect(content.meals.map((m) => [m.name, m.category, m.days])).toEqual([
      ['Café da manhã', 'breakfast', [0, 1]],
      ['Almoço', 'lunch', [0]],
    ]);
    expect(content.items).toHaveLength(3);
    await db.query(`DELETE FROM meal_plans WHERE id = $1`, [r.plan_id]);
  });

  it('REF 08: com bloco personalizado, o app antigo não grava (nem apaga) nada', async () => {
    const r = await save({ meals: [meal(10, 'Café', { category: 'breakfast' }), meal(11, 'Pré-treino')], items: [item(null, MEAL(11), 0)] });
    await expect(save({ plan: r.plan_id, meals: null, items: [{ day: 0, meal: 'breakfast', recipe_id: RECIPE, servings: 1 }] })).rejects.toThrow(
      /app_outdated/
    );
    expect((await db.query(`SELECT 1 FROM meal_plan_items WHERE plan_id = $1`, [r.plan_id])).rows).toHaveLength(1);
    await db.query(`DELETE FROM meal_plans WHERE id = $1`, [r.plan_id]);
  });

  it('REF 08: "Comi" do app antigo com dois blocos da mesma categoria no dia pede atualização', async () => {
    const r = await save({
      meals: [meal(12, 'Lanche', { category: 'snack' }), meal(13, 'Lanche', { category: 'snack' })],
      items: [item(null, MEAL(12), todayDay), item(null, MEAL(13), todayDay, RECIPE_2)],
    });
    await expect(
      asUser(db, PATIENT, (tx) => tx.query(`SELECT save_meal_check($1, app_today(), 'snack', 'ate', '[]', '', '[]')`, [r.plan_id]))
    ).rejects.toThrow(/app_outdated/);
    await db.query(`DELETE FROM meal_plans WHERE id = $1`, [r.plan_id]);
  });
});

describe('opções e trocas pelo id do item', () => {
  let planId: string;

  it('"Comi" com grupo de opções: exatamente uma opção do grupo', async () => {
    const r = await save({
      meals: [meal(14, 'Café')],
      items: [item(ITEM(20), MEAL(14), todayDay), item(ITEM(21), MEAL(14), todayDay, RECIPE_2, 1), item(ITEM(22), MEAL(14), todayDay, RECIPE_3, 1)],
    });
    planId = r.plan_id;
    await expect(check(planId, MEAL(14), 'ate', [entry(ITEM(20)), entry(ITEM(21)), entry(ITEM(22))])).rejects.toThrow(/validation_failed/);
    await expect(check(planId, MEAL(14), 'ate', [entry(ITEM(21))])).rejects.toThrow(/validation_failed/);
    const saved = await check(planId, MEAL(14), 'ate', [entry(ITEM(20), 'Omelete'), entry(ITEM(22), 'Iogurte')]);
    expect(saved.meal_name).toBe('Café');
    const rows = await db.query<{ recipe_id: string }>(`SELECT recipe_id FROM nutrition_log_entries WHERE plan_check_id = $1 ORDER BY recipe_title`, [saved.id]);
    // A receita vem do item do plano (não do que o app mandou).
    expect(rows.rows.map((x) => x.recipe_id)).toEqual([RECIPE_3, RECIPE]);
  });

  it('troca pedida pelo item guarda bloco e item; se o item muda na publicação, o pedido fica desatualizado', async () => {
    const request = await asUser(db, PATIENT, (tx) =>
      tx.query<{ id: string }>(
        `SELECT request_food_swap($1, NULL, NULL, NULL, NULL, NULL, 'Omelete', NULL, NULL, NULL, $2, 1, 'enjoei', $3) AS id`,
        [planId, RECIPE_2, ITEM(20)]
      )
    );
    const id = request.rows[0].id;
    const row = await db.query<{ meal_id: string; item_id: string; day: number; meal_name: string }>(
      `SELECT meal_id, item_id, day, meal_name FROM food_swap_requests WHERE id = $1`,
      [id]
    );
    expect(row.rows[0]).toEqual({ meal_id: MEAL(14), item_id: ITEM(20), day: todayDay, meal_name: 'Café' });

    // O nutricionista troca o item por outro e publica: o pedido não é aplicado a outro item.
    await save({ plan: planId, meals: [meal(14, 'Café')], items: [item(ITEM(23), MEAL(14), todayDay, RECIPE_3)] });
    const status = await db.query<{ status: string }>(`SELECT status FROM food_swap_requests WHERE id = $1`, [id]);
    expect(status.rows[0].status).toBe('outdated');
  });
});

describe('modelos e versão mínima do app', () => {
  it('o banco informa a versão mínima do app', async () => {
    expect((await db.query<{ v: number }>(`SELECT app_min_client() AS v`)).rows[0].v).toBe(3);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
