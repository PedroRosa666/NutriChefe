// Painel do administrador (20261029120000_admin_panel.sql): só administradores usam as funções,
// Premium de cortesia, moderação, comunicados e dados de demonstração.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const ADMIN = '00000000-0000-4000-8000-00000000004a';
const USER = '00000000-0000-4000-8000-00000000004b';
const AUTHOR = '00000000-0000-4000-8000-00000000004c';
const DEMO_PATIENT = '00000000-0000-4000-8000-00000000004d';
const DEMO_NUTRI = '00000000-0000-4000-8000-00000000004e';
const RECIPE = '00000000-0000-4000-8000-0000000004a1';

let db: PGlite;
let premiumPlan: string;

const asAnon = <T,>(fn: (tx: Transaction) => Promise<T>) =>
  db.transaction(async (tx) => {
    await tx.exec('SET LOCAL ROLE anon');
    return fn(tx);
  });

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'admin@x.com'), ('${USER}', 'ana@x.com'), ('${AUTHOR}', 'chef@x.com'),
      ('${DEMO_PATIENT}', 'demo1@example.com'), ('${DEMO_NUTRI}', 'demo2@example.com');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${ADMIN}', 'Admin', 'Client'), ('${USER}', 'Ana', 'Client'),
      ('${AUTHOR}', 'Chef', 'Nutritionist'), ('${DEMO_PATIENT}', '', 'Client'), ('${DEMO_NUTRI}', '', 'Client');
    INSERT INTO app_admins (user_id) VALUES ('${ADMIN}');
    INSERT INTO subscription_plans (name, price, currency, billing_period, features, stripe_price_id)
      VALUES ('Premium', 19.9, 'BRL', 'monthly', '["ai_mentoring"]', 'price_old');
    INSERT INTO recipes (id, title, author_id) VALUES ('${RECIPE}', 'Omelete', '${AUTHOR}'),
      (gen_random_uuid(), 'Salada', '${AUTHOR}'), (gen_random_uuid(), 'Sopa', '${AUTHOR}'), (gen_random_uuid(), 'Bolo', '${AUTHOR}');
  `);
  premiumPlan = (await db.query<{ id: string }>(`SELECT id FROM subscription_plans WHERE name = 'Premium'`)).rows[0].id;
});

describe('acesso ao painel', () => {
  it('quem não é administrador não usa as funções', async () => {
    for (const sql of ['SELECT admin_stats()', "SELECT * FROM admin_users('')", `SELECT admin_broadcast('all', 'a', 'b')`]) {
      await expect(asUser(db, USER, (tx) => tx.query(sql))).rejects.toThrow(/not_allowed/);
    }
  });

  it('administrador vê números e usuários; my_premium diz que é admin', async () => {
    const stats = await asUser(db, ADMIN, async (tx) => (await tx.query<{ s: { users: number } }>('SELECT admin_stats() AS s')).rows[0].s);
    expect(stats.users).toBe(5);
    const found = await asUser(db, ADMIN, async (tx) => (await tx.query<{ email: string }>(`SELECT email FROM admin_users('ana')`)).rows);
    expect(found).toEqual([{ email: 'ana@x.com' }]);
    const me = await asUser(db, ADMIN, async (tx) => (await tx.query<{ p: { admin: boolean } }>('SELECT my_premium() AS p')).rows[0].p);
    expect(me.admin).toBe(true);
  });
});

describe('Premium de cortesia e planos', () => {
  it('dá e tira Premium de cortesia', async () => {
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_grant_premium('${USER}', '${premiumPlan}', now() + interval '30 days')`));
    const has = () => db.query<{ ok: boolean }>(`SELECT has_feature('${USER}', 'ai_mentoring') AS ok`).then((r) => r.rows[0].ok);
    expect(await has()).toBe(true);
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_revoke_premium('${USER}')`));
    expect(await has()).toBe(false);
  });

  it('não substitui uma assinatura paga', async () => {
    await db.exec(`INSERT INTO user_subscriptions (user_id, plan_id, status, stripe_subscription_id) VALUES ('${AUTHOR}', '${premiumPlan}', 'active', 'sub_1')`);
    await expect(asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_grant_premium('${AUTHOR}', '${premiumPlan}', null)`))).rejects.toThrow(/has_paid_subscription/);
  });

  it('muda o preço do Stripe só com um ID válido', async () => {
    await expect(asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_set_plan('${premiumPlan}', null, 'abc', null)`))).rejects.toThrow(/invalid_price_id/);
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_set_plan('${premiumPlan}', 24.9, 'price_New123', null)`));
    const row = (await db.query<{ price: string; stripe_price_id: string }>(`SELECT price, stripe_price_id FROM subscription_plans WHERE id = '${premiumPlan}'`)).rows[0];
    expect([Number(row.price), row.stripe_price_id]).toEqual([24.9, 'price_New123']);
  });
});

describe('moderação e comunicados', () => {
  it('receita escondida some para visitantes e outros usuários, mas o autor e o admin veem', async () => {
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_set_recipe_hidden('${RECIPE}', true)`));
    const sees = (rows: { id: string }[]) => rows.some((r) => r.id === RECIPE);
    expect(sees((await asAnon((tx) => tx.query<{ id: string }>('SELECT id FROM recipes'))).rows)).toBe(false);
    expect(sees((await asUser(db, USER, (tx) => tx.query<{ id: string }>('SELECT id FROM recipes'))).rows)).toBe(false);
    expect(sees((await asUser(db, AUTHOR, (tx) => tx.query<{ id: string }>('SELECT id FROM recipes'))).rows)).toBe(true);
    expect(sees((await asUser(db, ADMIN, (tx) => tx.query<{ id: string }>('SELECT id FROM recipes'))).rows)).toBe(true);
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_set_recipe_hidden('${RECIPE}', false)`));
  });

  it('comunicado chega a quem foi escolhido', async () => {
    const n = await asUser(db, ADMIN, async (tx) => (await tx.query<{ n: number }>(`SELECT admin_broadcast('nutritionists', 'Novidade', 'Texto') AS n`)).rows[0].n);
    expect(n).toBe(1);
    const got = await asUser(db, AUTHOR, async (tx) => (await tx.query<{ kind: string }>(`SELECT kind FROM notifications WHERE kind = 'announcement'`)).rows);
    expect(got).toHaveLength(1);
  });
});

describe('dados de demonstração', () => {
  it('cria o acompanhamento demo com plano, mensagens e consulta, fora das métricas', async () => {
    await db.query(`SELECT admin_seed_demo('${ADMIN}', '${DEMO_PATIENT}', '${DEMO_NUTRI}')`);
    const counts = (await db.query<{ links: number; plans: number; msgs: number; appts: number }>(`
      SELECT (SELECT count(*)::int FROM nutritionist_clients WHERE client_id = '${DEMO_PATIENT}' AND status = 'active') links,
             (SELECT count(*)::int FROM meal_plans WHERE client_id = '${DEMO_PATIENT}') plans,
             (SELECT count(*)::int FROM care_messages WHERE client_id = '${DEMO_PATIENT}') msgs,
             (SELECT count(*)::int FROM appointments WHERE client_id = '${DEMO_PATIENT}') appts`)).rows[0];
    expect(counts).toEqual({ links: 1, plans: 1, msgs: 2, appts: 1 });
    const stats = await asUser(db, ADMIN, async (tx) => (await tx.query<{ s: { users: number } }>('SELECT admin_stats() AS s')).rows[0].s);
    expect(stats.users).toBe(3);
    await expect(asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_seed_demo('${ADMIN}', '${DEMO_PATIENT}', '${DEMO_NUTRI}')`))).rejects.toThrow(/permission denied/);
  });
});
