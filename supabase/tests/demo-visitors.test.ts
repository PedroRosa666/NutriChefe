// Demonstração pública (20261110120000_demo_visitors.sql): o visitante usa o app com um par demo,
// sem tocar em nada que pessoas reais vejam, e a IA para depois de 5 usos do par.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const REAL_CLIENT = '00000000-0000-4000-8000-0000000005a1';
const REAL_NUTRI = '00000000-0000-4000-8000-0000000005a2';
const V_PATIENT = '00000000-0000-4000-8000-0000000005a3';
const V_NUTRI = '00000000-0000-4000-8000-0000000005a4';
const RECIPE = '00000000-0000-4000-8000-0000000005b1';

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${REAL_CLIENT}', 'ana@x.com'), ('${REAL_NUTRI}', 'nutri@x.com'),
      ('${V_PATIENT}', 'visitor.p@example.com'), ('${V_NUTRI}', 'visitor.n@example.com');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${REAL_CLIENT}', 'Ana', 'Client'), ('${REAL_NUTRI}', 'Bia', 'Nutritionist'),
      ('${V_PATIENT}', '', 'Client'), ('${V_NUTRI}', '', 'Nutritionist');
    INSERT INTO recipes (id, title, author_id) VALUES ('${RECIPE}', 'Omelete', '${REAL_NUTRI}'),
      (gen_random_uuid(), 'Salada', '${REAL_NUTRI}'), (gen_random_uuid(), 'Sopa', '${REAL_NUTRI}'), (gen_random_uuid(), 'Bolo', '${REAL_NUTRI}');
    INSERT INTO demo_visitors (patient_id, nutritionist_id, ip_hash) VALUES ('${V_PATIENT}', '${V_NUTRI}', 'h');
  `);
  await db.query(`SELECT seed_demo_data('${V_PATIENT}', '${V_NUTRI}')`);
});

describe('dados do par', () => {
  it('vínculo ativo e plano publicado numa versão só', async () => {
    const r = (await db.query<{ links: number; versions: number }>(`
      SELECT (SELECT count(*)::int FROM nutritionist_clients WHERE client_id = '${V_PATIENT}' AND nutritionist_id = '${V_NUTRI}' AND status = 'active') links,
             (SELECT count(*)::int FROM meal_plan_versions WHERE client_id = '${V_PATIENT}') versions`)).rows[0];
    expect(r).toEqual({ links: 1, versions: 1 });
  });

  it('my_premium diz que é visitante só para o par', async () => {
    const visitor = (id: string) =>
      asUser(db, id, async (tx) => (await tx.query<{ p: { visitor: boolean } }>('SELECT my_premium() AS p')).rows[0].p.visitor);
    expect(await visitor(V_PATIENT)).toBe(true);
    expect(await visitor(V_NUTRI)).toBe(true);
    expect(await visitor(REAL_CLIENT)).toBe(false);
  });
});

describe('o visitante não alcança pessoas reais', () => {
  it('não cria receita nem avaliação', async () => {
    await expect(asUser(db, V_NUTRI, (tx) => tx.query(`INSERT INTO recipes (title, author_id) VALUES ('Spam', '${V_NUTRI}')`)))
      .rejects.toThrow(/demo_readonly/);
    await expect(asUser(db, V_PATIENT, (tx) => tx.query(`INSERT INTO reviews (recipe_id, user_id, rating) VALUES ('${RECIPE}', '${V_PATIENT}', 1)`)))
      .rejects.toThrow(/demo_readonly/);
  });

  it('não cria convite', async () => {
    await expect(asUser(db, V_NUTRI, (tx) => tx.query('SELECT create_nutritionist_invite()'))).rejects.toThrow(/demo_readonly/);
  });

  it('conta demo não se vincula a conta real', async () => {
    await expect(db.query(`INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${REAL_NUTRI}', '${V_PATIENT}', 'active')`))
      .rejects.toThrow(/demo_readonly/);
    await expect(db.query(`INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${V_NUTRI}', '${REAL_CLIENT}', 'active')`))
      .rejects.toThrow(/demo_readonly/);
  });

  it('perfil demo some para estranhos mesmo se ficar público', async () => {
    await db.query(`UPDATE profiles SET profile_visibility = 'public' WHERE id = '${V_NUTRI}'`);
    const sees = (viewer: string) =>
      asUser(db, viewer, async (tx) => (await tx.query(`SELECT 1 FROM profiles WHERE id = '${V_NUTRI}'`)).rows.length);
    expect(await sees(REAL_CLIENT)).toBe(0);
    expect(await sees(V_PATIENT)).toBe(1);
    expect(await sees(V_NUTRI)).toBe(1);
    const anon = await db.transaction(async (tx) => {
      await tx.exec('SET LOCAL ROLE anon');
      return (await tx.query(`SELECT id FROM profiles WHERE id IN ('${V_NUTRI}', '${REAL_NUTRI}')`)).rows.length;
    });
    expect(anon).toBe(1);
  });

  it('a trava não pega pessoa real', async () => {
    await db.query(`INSERT INTO recipes (title, author_id) VALUES ('Torta', '${REAL_NUTRI}')`);
    await expect(db.query(`INSERT INTO recipes (title, author_id) VALUES ('Spam', '${V_NUTRI}')`)).rejects.toThrow(/demo_readonly/);
  });
});

describe('auditoria (20261111120000_audit_fixes.sql)', () => {
  it('visitante não se vincula a conta demo de fora do par', async () => {
    const LAB = '00000000-0000-4000-8000-0000000005a5';
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${LAB}', 'demo.nutri@example.com');
      INSERT INTO profiles (id, full_name, user_type, is_demo) VALUES ('${LAB}', 'Lab', 'Nutritionist', true);`);
    await expect(db.query(`INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${LAB}', '${V_PATIENT}', 'active')`))
      .rejects.toThrow(/demo_readonly/);
  });

  it('ninguém logado cria a própria linha de perfil (crn_status viria escolhido)', async () => {
    const NEW = '00000000-0000-4000-8000-0000000005a6';
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${NEW}', 'novo@x.com')`);
    await expect(asUser(db, NEW, (tx) => tx.query(
      `INSERT INTO profiles (id, full_name, user_type, crn_status) VALUES ('${NEW}', 'X', 'Nutritionist', 'approved')`,
    ))).rejects.toThrow(/permission denied/);
  });

  it('nutricionista demo não entra na lista de Premium', async () => {
    const ids = (await db.query<{ id: string }>('SELECT pro_nutritionist_ids() AS id')).rows.map((r) => r.id);
    expect(ids).not.toContain(V_NUTRI);
  });
});

describe('IA da demonstração', () => {
  it('5 usos somando as duas contas do par; quem não é visitante fica de fora', async () => {
    const use = async (id: string) => (await db.query<{ ok: boolean | null }>(`SELECT consume_demo_ai('${id}', 5) AS ok`)).rows[0].ok;
    const results = [];
    for (const id of [V_PATIENT, V_NUTRI, V_PATIENT, V_NUTRI, V_PATIENT, V_NUTRI]) results.push(await use(id));
    expect(results).toEqual([true, true, true, true, true, false]);
    expect(await use(REAL_CLIENT)).toBeNull();
  });

  it('o app não chama a contagem diretamente', async () => {
    await expect(asUser(db, V_PATIENT, (tx) => tx.query(`SELECT consume_demo_ai('${V_PATIENT}', 5)`))).rejects.toThrow(/permission denied/);
  });
});

describe('limpeza dos pares vencidos', () => {
  it('apaga as duas contas e os dados delas', async () => {
    await db.query(`UPDATE demo_visitors SET expires_at = now() - interval '1 minute' WHERE patient_id = '${V_PATIENT}'`);
    const removed = (await db.query<{ n: number }>('SELECT cleanup_demo_visitors() AS n')).rows[0].n;
    expect(removed).toBe(1);
    const left = (await db.query<{ users: number; plans: number }>(`
      SELECT (SELECT count(*)::int FROM auth.users WHERE id IN ('${V_PATIENT}', '${V_NUTRI}')) users,
             (SELECT count(*)::int FROM meal_plans WHERE client_id = '${V_PATIENT}') plans`)).rows[0];
    expect(left).toEqual({ users: 0, plans: 0 });
  });
});
