// Etapa 2 (20261105120000_plan_versions.sql): rascunho com revisão, versões publicadas imutáveis,
// vigência, plano em uso, trocas e histórico mínimo. Os nomes HIST 0x são os critérios do plano.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-0000000002a1';
const OTHER_NUTRI = '00000000-0000-4000-8000-0000000002a2';
const PATIENT = '00000000-0000-4000-8000-0000000002a3';
const RECIPE = '00000000-0000-4000-8000-0000000002b1';
const RECIPE_2 = '00000000-0000-4000-8000-0000000002b2';
const ITEM_1 = '00000000-0000-4000-8000-0000000002c1';
const ITEM_2 = '00000000-0000-4000-8000-0000000002c2';

let db: PGlite;

interface SaveResult {
  plan_id: string;
  revision: number;
  version: { version_id: string; number: number; valid_from: string; new: boolean } | null;
}

const item = (id: string | null, recipe = RECIPE, day = 0, meal = 'breakfast') => ({ id, day, meal, recipe_id: recipe, servings: 1, note: '' });

const save = (
  uid: string,
  args: { plan?: string | null; items: object[]; rev?: number | null; publish?: boolean; op?: string | null; title?: string }
) =>
  asUser(db, uid, async (tx) =>
    (
      await tx.query<{ r: SaveResult }>(`SELECT save_plan_draft($1, $2, $3, '', $4::jsonb, $5, $6, $7) AS r`, [
        args.plan ?? null,
        PATIENT,
        args.title ?? 'Semana',
        JSON.stringify(args.items),
        args.rev ?? null,
        args.publish ?? false,
        args.op ?? null,
      ])
    ).rows[0].r
  );

const views = (uid: string) =>
  asUser(db, uid, async (tx) => (await tx.query<{ v: Record<string, unknown>[] }>(`SELECT plan_views($1) AS v`, [PATIENT])).rows[0].v);

const today = () => db.query<{ d: string }>(`SELECT app_today()::text AS d`).then((r) => r.rows[0].d);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${OTHER_NUTRI}'), ('${PATIENT}');
    INSERT INTO profiles (id, full_name, user_type) VALUES
      ('${NUTRI}', 'Dra. Ana', 'Nutritionist'), ('${OTHER_NUTRI}', 'Dr. Bruno', 'Nutritionist'), ('${PATIENT}', 'Carla', 'Client');
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES
      ('${NUTRI}', '${PATIENT}', 'active'), ('${OTHER_NUTRI}', '${PATIENT}', 'active');
    INSERT INTO recipes (id, title, nutrition_facts) VALUES
      ('${RECIPE}', 'Omelete', '{"calories": 300, "protein": 20, "carbs": 5, "fat": 20, "fiber": 1}'),
      ('${RECIPE_2}', 'Tapioca', '{"calories": 250, "protein": 4, "carbs": 50, "fat": 3, "fiber": 1}');
  `);
}, 60000);

describe('rascunho e publicação', () => {
  let planId: string;

  it('rascunho não aparece para o paciente; publicar cria a versão 1 com retrato', async () => {
    const r = await save(NUTRI, { items: [item(ITEM_1), item(ITEM_2, RECIPE_2, 0, 'lunch')] });
    planId = r.plan_id;
    expect(r.version).toBeNull();
    let plan = (await views(PATIENT)).find((p) => p.id === planId)!;
    expect(plan.current).toBeNull();

    const published = await asUser(db, NUTRI, (tx) => tx.query<{ r: SaveResult['version'] }>(`SELECT publish_plan($1, $2, NULL) AS r`, [planId, r.revision]));
    expect(published.rows[0].r).toMatchObject({ number: 1, valid_from: await today(), new: true });

    plan = (await views(PATIENT)).find((p) => p.id === planId)!;
    const content = (plan.current as { content: { items: { id: string }[]; recipes: Record<string, { title: string }> } }).content;
    expect(content.items.map((i) => i.id)).toEqual([ITEM_1, ITEM_2]);
    expect(content.recipes[RECIPE].title).toBe('Omelete');
    // Primeiro plano do paciente: entra em uso sozinho.
    expect(plan.active).toBe(true);
  });

  it('HIST 01: editar a receita depois não muda a versão publicada', async () => {
    await db.query(`UPDATE recipes SET title = 'Omelete nova', nutrition_facts = '{"calories": 999}' WHERE id = $1`, [RECIPE]);
    const plan = (await views(PATIENT)).find((p) => p.id === planId)!;
    const content = (plan.current as { content: { recipes: Record<string, { title: string; nutrition_facts: { calories: number } }> } }).content;
    expect(content.recipes[RECIPE]).toMatchObject({ title: 'Omelete', nutrition_facts: { calories: 300 } });
    await db.query(`UPDATE recipes SET title = 'Omelete', nutrition_facts = '{"calories": 300, "protein": 20}' WHERE id = $1`, [RECIPE]);
  });

  it('itens mantêm o id ao salvar (não são apagados e recriados)', async () => {
    const before = await db.query<{ revision: number }>(`SELECT revision FROM meal_plans WHERE id = $1`, [planId]);
    await save(NUTRI, { plan: planId, rev: before.rows[0].revision, items: [item(ITEM_2, RECIPE_2, 0, 'lunch'), item(ITEM_1), item(null, RECIPE, 1)] });
    const ids = (await db.query<{ id: string }>(`SELECT id FROM meal_plan_items WHERE plan_id = $1 ORDER BY position`, [planId])).rows.map((r) => r.id);
    expect(ids.slice(0, 2)).toEqual([ITEM_2, ITEM_1]);
    expect(ids).toHaveLength(3);
  });

  it('HIST 02: duas abas com a mesma revisão: a segunda recebe conflito', async () => {
    const rev = (await db.query<{ revision: number }>(`SELECT revision FROM meal_plans WHERE id = $1`, [planId])).rows[0].revision;
    await save(NUTRI, { plan: planId, rev, items: [item(ITEM_1)] });
    await expect(save(NUTRI, { plan: planId, rev, items: [item(ITEM_1), item(ITEM_2)] })).rejects.toThrow(/version_conflict/);
    // O conflito não gravou nada.
    expect((await db.query(`SELECT 1 FROM meal_plan_items WHERE plan_id = $1`, [planId])).rows).toHaveLength(1);
  });

  it('o paciente continua vendo a versão publicada até a próxima publicação', async () => {
    const plan = (await views(PATIENT)).find((p) => p.id === planId)!;
    expect((plan.current as { number: number }).number).toBe(1);
    expect(plan.revision).toBeGreaterThan(plan.published_revision as number);
  });

  it('HIST 03: publicação recusada não cria versão nem evento', async () => {
    const versions = async () => (await db.query(`SELECT 1 FROM meal_plan_versions WHERE plan_id = $1`, [planId])).rows.length;
    const events = async () => (await db.query(`SELECT 1 FROM care_events WHERE kind = 'plan_published'`)).rows.length;
    const [v0, e0] = [await versions(), await events()];
    await expect(asUser(db, OTHER_NUTRI, (tx) => tx.query(`SELECT publish_plan($1, NULL, NULL)`, [planId]))).rejects.toThrow();
    await expect(asUser(db, NUTRI, (tx) => tx.query(`SELECT publish_plan($1, 1, NULL)`, [planId]))).rejects.toThrow(/version_conflict/);
    expect([await versions(), await events()]).toEqual([v0, e0]);
  });

  it('com refeição marcada hoje, a nova versão vale a partir de amanhã', async () => {
    await asUser(db, PATIENT, (tx) =>
      tx.query(`INSERT INTO meal_plan_checks (client_id, plan_id, check_date, meal, status) VALUES ($1, $2, app_today(), 'breakfast', 'ate')`, [PATIENT, planId])
    );
    const check = await db.query<{ number: number }>(
      `SELECT v.number FROM meal_plan_checks c JOIN meal_plan_versions v ON v.id = c.version_id WHERE c.plan_id = $1`,
      [planId]
    );
    expect(check.rows[0].number).toBe(1);

    const r = await asUser(db, NUTRI, (tx) => tx.query<{ r: { number: number; valid_from: string } }>(`SELECT publish_plan($1, NULL, NULL) AS r`, [planId]));
    const tomorrow = (await db.query<{ d: string }>(`SELECT (app_today() + 1)::text AS d`)).rows[0].d;
    expect(r.rows[0].r).toMatchObject({ number: 2, valid_from: tomorrow });

    const plan = (await views(PATIENT)).find((p) => p.id === planId)!;
    expect((plan.current as { number: number }).number).toBe(1);
    expect(plan.next).toMatchObject({ number: 2, valid_from: tomorrow });
  });

  it('a mesma operação repetida não salva duas vezes; com outro conteúdo dá conflito', async () => {
    const OP = '00000000-0000-4000-8000-0000000002d1';
    const rev = (await db.query<{ revision: number }>(`SELECT revision FROM meal_plans WHERE id = $1`, [planId])).rows[0].revision;
    const first = await save(NUTRI, { plan: planId, rev, op: OP, items: [item(ITEM_1)] });
    const again = await save(NUTRI, { plan: planId, rev, op: OP, items: [item(ITEM_1)] });
    expect(again).toEqual(first);
    await expect(save(NUTRI, { plan: planId, rev, op: OP, items: [item(ITEM_2)] })).rejects.toThrow(/operation_conflict/);
  });
});

describe('plano em uso e plano próprio', () => {
  it('um segundo plano não tira o primeiro de uso; o paciente escolhe', async () => {
    const own = await save(PATIENT, { items: [item(null, RECIPE_2)], publish: true, title: 'Meu plano' });
    expect(own.version?.number).toBe(1);
    let list = await views(PATIENT);
    expect(list.find((p) => p.id === own.plan_id)!.active).toBe(false);

    await asUser(db, PATIENT, (tx) => tx.query(`SELECT select_active_plan($1)`, [own.plan_id]));
    list = await views(PATIENT);
    expect(list.filter((p) => p.active).map((p) => p.id)).toEqual([own.plan_id]);
  });

  it('o nutricionista não escolhe o plano em uso do paciente', async () => {
    const plan = (await views(PATIENT)).find((p) => p.created_by === NUTRI)!;
    await expect(asUser(db, NUTRI, (tx) => tx.query(`SELECT select_active_plan($1)`, [plan.id]))).rejects.toThrow(/not_allowed/);
  });
});

describe('trocas', () => {
  let planId: string;
  const ITEM = '00000000-0000-4000-8000-0000000002c9';

  const request = () =>
    asUser(db, PATIENT, (tx) =>
      tx.query<{ id: string }>(
        `SELECT request_food_swap($1, 2::smallint, 'dinner', NULL, $2, NULL, 'Omelete', NULL, NULL, NULL, $3, 1, 'Prefiro tapioca') AS id`,
        [planId, RECIPE, RECIPE_2]
      )
    ).then((r) => r.rows[0].id);
  const approve = (id: string) =>
    asUser(db, NUTRI, (tx) => tx.query(`SELECT resolve_food_swap($1, true, '', NULL, NULL, NULL, NULL, NULL)`, [id]));
  const swap = (id: string) =>
    db.query<{ effective_from: string | null; version_number: number }>(
      `SELECT s.effective_from::text, v.number AS version_number FROM food_swap_requests s JOIN meal_plan_versions v ON v.id = s.version_id WHERE s.id = $1`,
      [id]
    ).then((r) => r.rows[0]);

  beforeAll(async () => {
    planId = (await save(NUTRI, { items: [item(ITEM, RECIPE, 2, 'dinner')], publish: true, title: 'Plano trocas' })).plan_id;
  });

  it('aprovada sem outras alterações: publica já e diz desde quando vale', async () => {
    const id = await request();
    expect((await swap(id)).version_number).toBe(1);
    await approve(id);
    const s = await swap(id);
    expect(s.effective_from).toBe(await today());
    const latest = await db.query<{ number: number; content: { recipes: Record<string, unknown> } }>(
      `SELECT number, content FROM meal_plan_versions WHERE plan_id = $1 ORDER BY number DESC LIMIT 1`,
      [planId]
    );
    expect(latest.rows[0].number).toBe(2);
    expect(Object.keys(latest.rows[0].content.recipes)).toEqual([RECIPE_2]);
  });

  it('aprovada com outras alterações no rascunho: espera a próxima publicação', async () => {
    // Volta o item para omelete e deixa uma alteração sem publicar.
    const rev = (await db.query<{ revision: number }>(`SELECT revision FROM meal_plans WHERE id = $1`, [planId])).rows[0].revision;
    await save(NUTRI, { plan: planId, rev, items: [item(ITEM, RECIPE, 2, 'dinner')], publish: true, title: 'Plano trocas' });
    const rev2 = (await db.query<{ revision: number }>(`SELECT revision FROM meal_plans WHERE id = $1`, [planId])).rows[0].revision;
    await save(NUTRI, { plan: planId, rev: rev2, items: [item(ITEM, RECIPE, 2, 'dinner'), item(null, RECIPE, 3)], title: 'Plano trocas' });

    const id = await request();
    await approve(id);
    expect((await swap(id)).effective_from).toBeNull();
    await asUser(db, NUTRI, (tx) => tx.query(`SELECT publish_plan($1, NULL, NULL)`, [planId]));
    expect((await swap(id)).effective_from).not.toBeNull();
  });
});

describe('histórico mínimo (care_events)', () => {
  const events = (uid: string) =>
    asUser(db, uid, async (tx) => (await tx.query<{ kind: string; nutritionist_id: string | null }>(`SELECT kind, nutritionist_id FROM care_events ORDER BY occurred_at, id`)).rows);

  it('o paciente vê os eventos dele; cada nutricionista só os dos próprios planos', async () => {
    const mine = await events(PATIENT);
    expect(mine.some((e) => e.kind === 'plan_published')).toBe(true);
    const other = await events(OTHER_NUTRI);
    expect(other.filter((e) => e.kind === 'plan_published' && e.nutritionist_id === NUTRI)).toEqual([]);
  });

  it('metas alteradas geram um evento; ninguém apaga eventos pela API', async () => {
    await asUser(db, NUTRI, (tx) => tx.query(`INSERT INTO nutrition_goals (user_id, calories, set_by) VALUES ($1, 1800, $2)`, [PATIENT, NUTRI]));
    expect((await events(OTHER_NUTRI)).some((e) => e.kind === 'goals_changed')).toBe(true);
    await expect(asUser(db, PATIENT, (tx) => tx.query(`DELETE FROM care_events`))).rejects.toThrow(/permission denied/);
  });

  it('encerrar o vínculo gera evento; depois o nutricionista não lê mais o histórico', async () => {
    await asUser(db, PATIENT, (tx) =>
      tx.query(`UPDATE nutritionist_clients SET status = 'ended', ended_at = now() WHERE nutritionist_id = $1 AND client_id = $2`, [OTHER_NUTRI, PATIENT])
    );
    expect((await events(PATIENT)).some((e) => e.kind === 'link_ended')).toBe(true);
    expect(await events(OTHER_NUTRI)).toEqual([]);
  });
});
