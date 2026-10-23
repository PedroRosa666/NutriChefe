// Premium do cliente (20261030120000_client_premium.sql): receitas exclusivas só para quem tem
// Premium, vitrine para os outros, e os números das conquistas e desafios.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const FREE = '00000000-0000-4000-8000-00000000005a';
const PREMIUM = '00000000-0000-4000-8000-00000000005b';
const AUTHOR = '00000000-0000-4000-8000-00000000005c';
const PRO_NUTRI = '00000000-0000-4000-8000-00000000005d';
const PATIENT = '00000000-0000-4000-8000-00000000005e';
const ADMIN = '00000000-0000-4000-8000-00000000005f';
const EXCLUSIVE = '00000000-0000-4000-8000-0000000005a1';
const OPEN = '00000000-0000-4000-8000-0000000005a2';

let db: PGlite;

const asAnon = <T,>(fn: (tx: Transaction) => Promise<T>) =>
  db.transaction(async (tx) => {
    await tx.exec('SET LOCAL ROLE anon');
    return fn(tx);
  });

const visibleIds = (tx: Transaction) => tx.query<{ id: string }>('SELECT id FROM recipes ORDER BY title').then((r) => r.rows.map((x) => x.id));

beforeAll(async () => {
  db = await createTestDb();
  const users = [FREE, PREMIUM, AUTHOR, PRO_NUTRI, PATIENT, ADMIN];
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ${users.map((u) => `('${u}')`).join(', ')};
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${FREE}', 'Grátis', 'Client'), ('${PREMIUM}', 'Premium', 'Client'),
      ('${AUTHOR}', 'Chef', 'Nutritionist'), ('${PRO_NUTRI}', 'Pro', 'Nutritionist'), ('${PATIENT}', 'Paciente', 'Client'), ('${ADMIN}', 'Admin', 'Client');
    INSERT INTO app_admins (user_id) VALUES ('${ADMIN}');
    INSERT INTO subscription_plans (name, price, currency, billing_period, features) VALUES ('Premium', 19.9, 'BRL', 'monthly', '["ai_mentoring"]');
    INSERT INTO user_subscriptions (user_id, plan_id, status) SELECT '${PREMIUM}', id, 'active' FROM subscription_plans WHERE name = 'Premium';
    INSERT INTO user_subscriptions (user_id, plan_id, status) SELECT '${PRO_NUTRI}', id, 'active' FROM subscription_plans WHERE name = 'Premium Nutricionista';
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${PRO_NUTRI}', '${PATIENT}', 'active');
    INSERT INTO recipes (id, title, author_id, premium_only, nutrition_facts) VALUES
      ('${EXCLUSIVE}', 'A exclusiva', '${AUTHOR}', true, '{"calories": 420}'),
      ('${OPEN}', 'B aberta', '${AUTHOR}', false, '{"calories": 300}');
  `);
});

describe('receitas exclusivas', () => {
  it('visitante e cliente grátis não leem a receita exclusiva', async () => {
    expect(await asAnon(visibleIds)).toEqual([OPEN]);
    expect(await asUser(db, FREE, visibleIds)).toEqual([OPEN]);
  });

  it('Premium, paciente de nutricionista Premium, autor e admin leem', async () => {
    for (const uid of [PREMIUM, PATIENT, AUTHOR, ADMIN]) {
      expect(await asUser(db, uid, visibleIds)).toEqual([EXCLUSIVE, OPEN]);
    }
  });

  it('a vitrine mostra só título, foto e calorias da exclusiva para todos', async () => {
    const rows = await asAnon(async (tx) => (await tx.query<{ id: string; calories: string }>('SELECT id, calories FROM premium_recipe_teasers()')).rows);
    expect(rows).toEqual([{ id: EXCLUSIVE, calories: '420' }]);
  });

  it('só o admin marca e desmarca receita exclusiva', async () => {
    await expect(asUser(db, FREE, (tx) => tx.query(`SELECT admin_set_recipe_premium('${OPEN}', true)`))).rejects.toThrow(/not_allowed/);
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_set_recipe_premium('${OPEN}', true)`));
    const listed = await asUser(db, ADMIN, async (tx) => (await tx.query<{ premium_only: boolean }>(`SELECT premium_only FROM admin_recipes('B aberta')`)).rows);
    expect(listed).toEqual([{ premium_only: true }]);
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT admin_set_recipe_premium('${OPEN}', false)`));
  });
});

describe('progresso: conquistas e desafios', () => {
  it('conta dias de diário, sequência, pesagens e refeições da semana', async () => {
    await db.exec(`
      INSERT INTO nutrition_goals (user_id, calories, protein) VALUES ('${PREMIUM}', 2000, 100);
      INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_title, servings, per_serving)
        SELECT '${PREMIUM}', (now() AT TIME ZONE 'America/Sao_Paulo')::date - d, 'Prato', 2, '{"calories": 1000, "protein": 60}'
        FROM generate_series(0, 2) d;
      INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_title, servings, per_serving)
        VALUES ('${PREMIUM}', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 10, 'Antigo', 1, '{"calories": 500}');
      INSERT INTO weight_logs (user_id, logged_on, weight_kg) VALUES
        ('${PREMIUM}', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 20, 80), ('${PREMIUM}', (now() AT TIME ZONE 'America/Sao_Paulo')::date, 77.5);
    `);
    const p = await asUser(db, PREMIUM, async (tx) => (await tx.query<{ p: Record<string, any> }>('SELECT my_progress() AS p')).rows[0].p);
    expect(p).toMatchObject({ diary_days: 4, streak: 3, best_streak: 3, weight_logs: 2, ate_meals: 0 });
    expect(Number(p.weight_change)).toBe(-2.5);
    // Os três dias têm 2000 kcal e 120 g de proteína: batem as duas metas (quantos caem na semana depende do dia de hoje).
    expect(p.week.protein_days).toBe(p.week.diary_days);
    expect(p.week.calorie_days).toBe(p.week.diary_days);
    expect(p.week.diary_days).toBeGreaterThanOrEqual(1);
  });

  it('sem metas, os desafios de meta ficam vazios; sem login, recusa', async () => {
    const p = await asUser(db, FREE, async (tx) => (await tx.query<{ p: Record<string, any> }>('SELECT my_progress() AS p')).rows[0].p);
    expect(p).toMatchObject({ diary_days: 0, streak: 0 });
    expect(p.week.protein_days).toBeNull();
    await expect(asAnon((tx) => tx.query('SELECT my_progress()'))).rejects.toThrow();
  });
});
