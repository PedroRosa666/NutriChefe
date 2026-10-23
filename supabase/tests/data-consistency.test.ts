// Fase 2 (20261031120000_data_consistency.sql): planos do nutricionista, marcações por plano, fim do
// acompanhamento, receita e alimento apagados e plano salvo numa transação só.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-00000000006a';
const NUTRI2 = '00000000-0000-4000-8000-00000000006b';
const PATIENT = '00000000-0000-4000-8000-00000000006c';
const RECIPE = '00000000-0000-4000-8000-0000000006a1';
const RECIPE2 = '00000000-0000-4000-8000-0000000006a2';
const FOOD = '00000000-0000-4000-8000-0000000006f1';

let db: PGlite;

const link = (nutri: string) =>
  asUser(db, nutri, async (tx) => {
    const code = (await tx.query<{ code: string }>('SELECT (create_nutritionist_invite()).code')).rows[0].code;
    return code;
  }).then((code) => asUser(db, PATIENT, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [code])));

const endLink = (nutri: string) =>
  asUser(db, PATIENT, (tx) => tx.query(`UPDATE nutritionist_clients SET status = 'ended', ended_at = now() WHERE nutritionist_id = $1`, [nutri]));

const newPlan = async (author: string, title: string, items: unknown[] = [{ day: 0, meal: 'lunch', recipe_id: RECIPE, servings: 1 }]) =>
  asUser(db, author, async (tx) =>
    (await tx.query<{ id: string }>('SELECT save_meal_plan(NULL, $1, $2, $3, $4) AS id', [PATIENT, title, '', JSON.stringify(items)])).rows[0].id
  );

const unread = (uid: string) =>
  db.query<{ kind: string }>('SELECT kind FROM notifications WHERE user_id = $1 AND read_at IS NULL ORDER BY created_at', [uid]).then((r) => r.rows.map((x) => x.kind));

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${NUTRI2}'), ('${PATIENT}');
    INSERT INTO profiles (id, full_name, user_type, crn_status) VALUES
      ('${NUTRI}', 'Dra. Ana', 'Nutritionist', 'approved'), ('${NUTRI2}', 'Dr. Bruno', 'Nutritionist', 'approved'),
      ('${PATIENT}', 'Carla', 'Client', 'none');
    INSERT INTO recipes (id, title, author_id) VALUES ('${RECIPE}', 'Omelete', '${NUTRI2}'), ('${RECIPE2}', 'Sopa', '${NUTRI2}');
    -- Como em produção: o autor apaga a própria receita.
    CREATE POLICY "Authors delete recipes" ON recipes FOR DELETE TO authenticated USING (author_id = auth.uid());
    GRANT DELETE ON recipes TO authenticated;
    INSERT INTO foods (id, owner_id, name, category) VALUES ('${FOOD}', '${NUTRI}', 'Pão da casa', 'Cereais');
  `);
  await link(NUTRI);
  await link(NUTRI2);
}, 60000);

describe('planos do nutricionista', () => {
  it('o paciente não apaga o plano do nutricionista durante o acompanhamento', async () => {
    const plan = await newPlan(NUTRI, 'Plano da Ana');
    await asUser(db, PATIENT, (tx) => tx.query('DELETE FROM meal_plans WHERE id = $1', [plan]));
    expect((await db.query('SELECT 1 FROM meal_plans WHERE id = $1', [plan])).rows).toHaveLength(1);
  });

  it('save_meal_plan grava tudo ou nada', async () => {
    const plan = await newPlan(NUTRI, 'Transação');
    const bad = [{ day: 0, meal: 'lunch', recipe_id: RECIPE, servings: 1 }, { day: 9, meal: 'lunch', recipe_id: RECIPE, servings: 1 }];
    await expect(asUser(db, NUTRI, (tx) => tx.query('SELECT save_meal_plan($1, $2, $3, $4, $5)', [plan, PATIENT, 'Novo', '', JSON.stringify(bad)]))).rejects.toThrow();
    const row = (await db.query<{ title: string; n: number }>(
      'SELECT p.title, (SELECT count(*)::int FROM meal_plan_items WHERE plan_id = p.id) AS n FROM meal_plans p WHERE id = $1', [plan])).rows[0];
    expect(row).toEqual({ title: 'Transação', n: 1 });
  });

  it('quem não acompanha o paciente não cria plano para ele', async () => {
    await expect(newPlan(PATIENT === NUTRI ? NUTRI : '00000000-0000-4000-8000-0000000000ff', 'X')).rejects.toThrow();
  });
});

describe('marcação de refeição por plano', () => {
  it('marcar a mesma refeição em dois planos guarda as duas', async () => {
    const [a, b] = await db.query<{ id: string }>(`SELECT id FROM meal_plans WHERE client_id = $1 ORDER BY created_at LIMIT 1`, [PATIENT])
      .then(async (r) => [r.rows[0].id, await newPlan(NUTRI2, 'Plano do Bruno')]);
    for (const plan of [a, b]) {
      await asUser(db, PATIENT, (tx) => tx.query(
        `INSERT INTO meal_plan_checks (client_id, plan_id, check_date, meal, status) VALUES ($1, $2, current_date, 'lunch', 'ate')
         ON CONFLICT (client_id, plan_id, check_date, meal) DO UPDATE SET status = 'ate'`, [PATIENT, plan]));
    }
    expect((await db.query('SELECT 1 FROM meal_plan_checks WHERE client_id = $1', [PATIENT])).rows).toHaveLength(2);
  });
});

describe('fim do acompanhamento', () => {
  it('avisos do acompanhamento ficam lidos, as metas deixam de ser do nutricionista e o plano antigo pode ser apagado', async () => {
    await db.exec(`
      INSERT INTO nutrition_goals (user_id, calories, set_by) VALUES ('${PATIENT}', 1800, '${NUTRI}');
      INSERT INTO notifications (user_id, kind, ref_id) VALUES ('${PATIENT}', 'message', '${NUTRI}'), ('${PATIENT}', 'message', '${NUTRI2}');
    `);
    const before = (await db.query<{ created_at: string }>('SELECT created_at FROM nutritionist_clients WHERE nutritionist_id = $1', [NUTRI])).rows[0];
    await endLink(NUTRI);

    const kinds = await unread(PATIENT);
    // Sobra só o aviso do Bruno (acompanhamento ativo); o plano da Ana não aparece mais como novidade.
    expect(kinds.filter((k) => k === 'message')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'plan_updated')).toHaveLength(1);
    expect((await db.query<{ set_by: string | null }>('SELECT set_by FROM nutrition_goals WHERE user_id = $1', [PATIENT])).rows[0].set_by).toBeNull();

    const archived = await asUser(db, PATIENT, async (tx) => (await tx.query<{ n: number }>('SELECT my_archived_plans() AS n')).rows[0].n);
    expect(archived).toBe(2);
    expect(await asUser(db, PATIENT, async (tx) => (await tx.query<{ n: number }>('SELECT delete_my_archived_plans() AS n')).rows[0].n)).toBe(2);
    expect((await db.query('SELECT 1 FROM meal_plans WHERE created_by = $1', [NUTRI])).rows).toHaveLength(0);

    // Recomeçar mantém a data de início.
    await link(NUTRI);
    const after = (await db.query<{ created_at: string }>('SELECT created_at FROM nutritionist_clients WHERE nutritionist_id = $1', [NUTRI])).rows[0];
    expect(String(after.created_at)).toBe(String(before.created_at));
  });
});

describe('receita e alimento apagados', () => {
  it('receita apagada avisa quem tinha ela no plano e não trava com pedido de troca sem motivo', async () => {
    const plan = await newPlan(NUTRI, 'Com sopa', [{ day: 1, meal: 'dinner', recipe_id: RECIPE2, servings: 1 }]);
    await db.query(
      `INSERT INTO food_swap_requests (plan_id, client_id, nutritionist_id, day, meal, original_recipe_id, original_label, requested_recipe_id)
       VALUES ($1, $2, $3, 1, 'dinner', $4, 'Sopa', $4)`, [plan, PATIENT, NUTRI, RECIPE2]);
    await asUser(db, NUTRI2, (tx) => tx.query('DELETE FROM recipes WHERE id = $1', [RECIPE2]));

    const notes = (await db.query<{ user_id: string; data: { item: string } }>(`SELECT user_id, data FROM notifications WHERE kind = 'plan_item_removed'`)).rows;
    expect(notes.map((n) => n.user_id).sort()).toEqual([NUTRI, PATIENT].sort());
    expect(notes[0].data.item).toBe('Sopa');
    const swap = (await db.query<{ status: string; reason: string }>('SELECT status, reason FROM food_swap_requests WHERE plan_id = $1', [plan])).rows[0];
    expect(swap.status).toBe('canceled');
    expect(swap.reason).toContain('Sopa');
  });

  it('excluir a conta do nutricionista não trava por alimento próprio no plano do paciente', async () => {
    // Plano do próprio paciente com o alimento da Ana.
    await asUser(db, PATIENT, (tx) => tx.query('SELECT save_meal_plan(NULL, $1, $2, $3, $4)', [PATIENT, 'Meu plano', '', JSON.stringify([{ day: 0, meal: 'breakfast', food_id: FOOD, grams: 50 }])]));
    await asUser(db, NUTRI, (tx) => tx.query('SELECT delete_my_account()'));
    expect((await db.query('SELECT 1 FROM foods WHERE id = $1', [FOOD])).rows).toHaveLength(0);
    expect(await unread(PATIENT)).toContain('plan_item_removed');
  });
});
