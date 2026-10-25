// Conversão dos dados que já existem (20261106120000_custom_meals.sql): planos, versões publicadas,
// marcações, diário e trocas gravados no formato das quatro refeições passam para blocos, sem mudar
// o conteúdo (REF 07), e continuam funcionando com o app novo e o antigo.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigration, asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-0000000005a1';
const PATIENT = '00000000-0000-4000-8000-0000000005a3';
const RECIPE = '00000000-0000-4000-8000-0000000005b1';
const RECIPE_2 = '00000000-0000-4000-8000-0000000005b2';
const RECIPE_3 = '00000000-0000-4000-8000-0000000005b3';

let db: PGlite;
let planId: string;
let todayDay: number;

type Item = { id: string; day: number; meal: string; meal_id?: string; recipe_id: string; option_group: number | null };
type Content = { format?: number; meals?: { id: string; name: string; category: string; days: number[] }[]; items: Item[] };

const versionContent = async () =>
  (await db.query<{ content: Content }>(`SELECT content FROM meal_plan_versions WHERE plan_id = $1 ORDER BY number DESC LIMIT 1`, [planId])).rows[0]
    .content;

let before: Content;

beforeAll(async () => {
  db = await createTestDb({ until: '20261106120000_custom_meals.sql' });
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${PATIENT}');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${NUTRI}', 'Dra. Ana', 'Nutritionist'), ('${PATIENT}', 'Carla', 'Client');
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${NUTRI}', '${PATIENT}', 'active');
    INSERT INTO recipes (id, title, nutrition_facts) VALUES
      ('${RECIPE}', 'Omelete', '{"calories": 300}'), ('${RECIPE_2}', 'Tapioca', '{"calories": 250}'), ('${RECIPE_3}', 'Iogurte', '{"calories": 120}');
  `);
  todayDay = (await db.query<{ d: number }>(`SELECT (extract(isodow FROM app_today())::int - 1) AS d`)).rows[0].d;

  // Plano publicado pelo app de antes: café (com grupo de opções) e almoço hoje, jantar amanhã.
  const items = [
    { day: todayDay, meal: 'breakfast', recipe_id: RECIPE, servings: 1, note: '' },
    { day: todayDay, meal: 'breakfast', recipe_id: RECIPE_2, servings: 1, option_group: 1, note: '' },
    { day: todayDay, meal: 'breakfast', recipe_id: RECIPE_3, servings: 1, option_group: 1, note: '' },
    { day: todayDay, meal: 'lunch', recipe_id: RECIPE_2, servings: 2, note: 'sem sal' },
    { day: (todayDay + 1) % 7, meal: 'dinner', recipe_id: RECIPE, servings: 1, note: '' },
  ];
  const saved = await asUser(db, NUTRI, (tx) =>
    tx.query<{ r: { plan_id: string } }>(`SELECT save_plan_draft(NULL, $1, 'Semana', '', $2::jsonb, NULL, true, NULL) AS r`, [PATIENT, JSON.stringify(items)])
  );
  planId = saved.rows[0].r.plan_id;
  before = await versionContent();

  // "Comi" no café de hoje (app antigo) e um pedido de troca do almoço.
  await asUser(db, PATIENT, (tx) =>
    tx.query(`SELECT save_meal_check($1, app_today(), 'breakfast', 'ate', '[]', '', $2::jsonb)`, [
      planId,
      JSON.stringify([{ recipe_id: RECIPE, title: 'Omelete', servings: 1, per_serving: { calories: 300 } }]),
    ])
  );
  await asUser(db, PATIENT, (tx) =>
    tx.query(`SELECT request_food_swap($1, $2, 'lunch', NULL, $3, NULL, 'Tapioca', NULL, NULL, NULL, $4, 1, 'enjoei')`, [
      planId,
      todayDay,
      RECIPE_2,
      RECIPE_3,
    ])
  );

  await applyMigration(db, '20261106120000_custom_meals.sql');
}, 60000);

describe('conversão para blocos de refeição', () => {
  it('REF 07: a versão publicada ganha os blocos e o mesmo conteúdo, item por item', async () => {
    const after = await versionContent();
    expect(after.format).toBe(2);
    expect(after.meals!.map((m) => [m.name, m.category])).toEqual([
      ['Café da manhã', 'breakfast'],
      ['Almoço', 'lunch'],
      ['Jantar', 'dinner'],
    ]);
    expect(after.meals!.find((m) => m.category === 'dinner')!.days).toEqual([(todayDay + 1) % 7]);
    // Mesmos itens, na mesma ordem; cada um no bloco da sua refeição.
    const strip = (i: Item) => ({ ...i, meal_id: undefined });
    expect(after.items.map(strip)).toEqual(before.items.map(strip));
    for (const item of after.items) expect(after.meals!.find((m) => m.id === item.meal_id)!.category).toBe(item.meal);
  });

  it('marcação, diário e troca ficam ligados ao bloco certo', async () => {
    const breakfast = (await db.query<{ id: string }>(`SELECT id FROM meal_plan_meals WHERE plan_id = $1 AND category = 'breakfast'`, [planId])).rows[0].id;
    const check = (await db.query<{ meal_id: string; meal_name: string }>(`SELECT meal_id, meal_name FROM meal_plan_checks WHERE plan_id = $1`, [planId])).rows;
    expect(check).toEqual([{ meal_id: breakfast, meal_name: 'Café da manhã' }]);
    const diary = (await db.query<{ meal_id: string }>(`SELECT meal_id FROM nutrition_log_entries WHERE user_id = $1`, [PATIENT])).rows;
    expect(diary).toEqual([{ meal_id: breakfast }]);
    const swap = (await db.query<{ meal_name: string; item_id: string | null }>(`SELECT meal_name, item_id FROM food_swap_requests WHERE plan_id = $1`, [planId])).rows[0];
    expect(swap.meal_name).toBe('Almoço');
    expect(swap.item_id).not.toBeNull();
  });

  it('o app novo marca "Comi" na versão convertida pelo id do bloco e dos itens', async () => {
    const content = await versionContent();
    const breakfast = content.meals!.find((m) => m.category === 'breakfast')!;
    const fixed = content.items.find((i) => i.meal_id === breakfast.id && i.option_group === null)!;
    const option = content.items.find((i) => i.meal_id === breakfast.id && i.option_group === 1)!;
    await asUser(db, PATIENT, (tx) =>
      tx.query(`SELECT record_meal_check($1, app_today(), $2, 'ate', $3::jsonb, '', NULL)`, [
        planId,
        breakfast.id,
        JSON.stringify([fixed, option].map((i) => ({ item_id: i.id, title: 'x', servings: 1, per_serving: { calories: 1 } }))),
      ])
    );
    // A mesma marcação (não uma segunda): o diário dela foi substituído.
    expect((await db.query(`SELECT 1 FROM meal_plan_checks WHERE plan_id = $1`, [planId])).rows).toHaveLength(1);
    expect((await db.query(`SELECT 1 FROM nutrition_log_entries WHERE user_id = $1`, [PATIENT])).rows).toHaveLength(2);
  });

  it('o app antigo continua salvando o plano que só tem as quatro refeições', async () => {
    const rev = (await db.query<{ revision: number }>(`SELECT revision FROM meal_plans WHERE id = $1`, [planId])).rows[0].revision;
    await asUser(db, NUTRI, (tx) =>
      tx.query(`SELECT save_plan_draft($1, $2, 'Semana', '', $3::jsonb, $4, false, NULL)`, [
        planId,
        PATIENT,
        JSON.stringify([{ day: 0, meal: 'snack', recipe_id: RECIPE, servings: 1, note: '' }]),
        rev,
      ])
    );
    const meals = (await db.query<{ category: string }>(`SELECT category FROM meal_plan_meals WHERE plan_id = $1 ORDER BY position`, [planId])).rows;
    expect(meals.map((m) => m.category)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
  });
});
