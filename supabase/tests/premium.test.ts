// Premium do nutricionista (20261028120000_nutritionist_premium.sql): limite de pacientes no
// plano grátis, IA incluída para os pacientes, painel de atenção e destaque.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const FREE_NUTRI = '00000000-0000-4000-8000-00000000003a';
const PRO_NUTRI = '00000000-0000-4000-8000-00000000003b';
const patient = (i: number) => `00000000-0000-4000-8000-0000000003${String(i).padStart(2, '0')}`;

let db: PGlite;

const invite = (uid: string) =>
  asUser(db, uid, async (tx) => (await tx.query<{ code: string }>('SELECT (create_nutritionist_invite()).code')).rows[0].code);
const redeem = (uid: string, code: string) => asUser(db, uid, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [code]));

beforeAll(async () => {
  db = await createTestDb();
  const patients = Array.from({ length: 8 }, (_, i) => patient(i));
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${FREE_NUTRI}'), ('${PRO_NUTRI}'), ${patients.map((p) => `('${p}')`).join(', ')};
    INSERT INTO profiles (id, full_name, user_type, crn_status) VALUES
      ('${FREE_NUTRI}', 'Grátis', 'Nutritionist', 'approved'),
      ('${PRO_NUTRI}', 'Pro', 'Nutritionist', 'approved'),
      ${patients.map((p, i) => `('${p}', 'Paciente ${i}', 'Client', 'none')`).join(', ')};
    INSERT INTO user_subscriptions (user_id, plan_id, status)
      SELECT '${PRO_NUTRI}', id, 'active' FROM subscription_plans WHERE name = 'Premium Nutricionista';
  `);
});

describe('limite de pacientes', () => {
  it('no plano grátis, o 6º paciente é recusado e não dá para criar convite', async () => {
    for (let i = 0; i < 5; i++) await redeem(patient(i), await invite(FREE_NUTRI));
    await expect(invite(FREE_NUTRI)).rejects.toThrow(/patient_limit/);
  });

  it('convite criado antes de chegar ao limite também é recusado no aceite', async () => {
    await db.exec(`UPDATE nutritionist_clients SET status = 'ended' WHERE client_id = '${patient(4)}'`);
    const code = await invite(FREE_NUTRI);
    await redeem(patient(4), await invite(FREE_NUTRI)).catch(() => undefined);
    await expect(redeem(patient(5), code)).rejects.toThrow(/patient_limit/);
  });

  it('nutricionista Premium não tem limite', async () => {
    for (let i = 0; i < 7; i++) await redeem(patient(i), await invite(PRO_NUTRI));
    const n = await asUser(db, PRO_NUTRI, async (tx) => (await tx.query<{ p: { active_patients: number; nutritionist_pro: boolean } }>('SELECT my_premium() AS p')).rows[0].p);
    expect(n).toMatchObject({ active_patients: 7, nutritionist_pro: true });
  });
});

describe('IA incluída para os pacientes', () => {
  it('paciente de nutricionista Premium tem acesso pela conta do nutricionista', async () => {
    const access = (uid: string) => db.query<{ a: { source: string | null; nutritionist_id?: string } }>(`SELECT ai_access('${uid}') AS a`).then((r) => r.rows[0].a);
    expect(await access(patient(6))).toEqual({ source: 'nutritionist', nutritionist_id: PRO_NUTRI });
    expect((await access(patient(7))).source).toBeNull();
    expect(await access(PRO_NUTRI)).toEqual({ source: 'own', nutritionist_pro: true });
    const mine = await asUser(db, patient(6), async (tx) => (await tx.query<{ p: { ai: boolean; ai_via_nutritionist: string } }>('SELECT my_premium() AS p')).rows[0].p);
    expect(mine).toMatchObject({ ai: false, ai_via_nutritionist: PRO_NUTRI });
  });

  it('o app não chama ai_access', async () => {
    await expect(asUser(db, patient(6), (tx) => tx.query(`SELECT ai_access('${patient(6)}')`))).rejects.toThrow(/permission denied/);
  });
});

describe('painel de atenção e destaque', () => {
  it('lista os pacientes ativos do nutricionista com o último registro', async () => {
    await db.exec(`INSERT INTO nutrition_log_entries (user_id, entry_date) VALUES ('${patient(0)}', '2026-10-20')`);
    const rows = await asUser(db, PRO_NUTRI, async (tx) => (await tx.query<{ client_id: string; last_log: string | null; pending_swaps: number }>('SELECT * FROM patients_attention()')).rows);
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.client_id === patient(0))?.last_log).toBeTruthy();
    expect(rows.every((r) => r.pending_swaps === 0)).toBe(true);
  });

  it('só nutricionistas Premium aparecem em destaque', async () => {
    const ids = (await db.query<{ id: string }>('SELECT pro_nutritionist_ids() AS id')).rows.map((r) => r.id);
    expect(ids).toEqual([PRO_NUTRI]);
  });
});
