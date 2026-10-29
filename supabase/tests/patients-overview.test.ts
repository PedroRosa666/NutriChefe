// Lista de pacientes numa consulta só (20261113120000_patients_overview.sql).
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-0000000006a1';
const PATIENT = '00000000-0000-4000-8000-0000000006a2';
const STRANGER = '00000000-0000-4000-8000-0000000006a3';

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${NUTRI}', 'n@x.com'), ('${PATIENT}', 'p@x.com'), ('${STRANGER}', 's@x.com');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${NUTRI}', 'Nutri', 'Nutritionist'), ('${PATIENT}', 'Ana', 'Client'),
      ('${STRANGER}', 'Bia', 'Nutritionist');
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${NUTRI}', '${PATIENT}', 'active');
    INSERT INTO nutrition_goals (user_id, calories) VALUES ('${PATIENT}', 1800);
    -- Dois registros hoje, um há 3 dias e um há 20 dias (fora da semana, mas é o histórico).
    INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_title, servings, per_serving) VALUES
      ('${PATIENT}', app_today(), 'Café', 1, '{"calories": 400}'),
      ('${PATIENT}', app_today(), 'Almoço', 2, '{"calories": 300}'),
      ('${PATIENT}', app_today() - 3, 'Jantar', 1, '{"calories": 500}'),
      ('${PATIENT}', app_today() - 20, 'Antigo', 1, '{"calories": 999}');
  `);
});

describe('patients_overview', () => {
  it('resume a semana e guarda o último registro', async () => {
    const rows = await asUser(db, NUTRI, async (tx) =>
      (await tx.query<{ client_id: string; days7: number; kcal7: string; goal_kcal: string; last_log: string; pending_swaps: number; unread_messages: number }>(
        'SELECT * FROM patients_overview()'
      )).rows
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].client_id).toBe(PATIENT);
    expect(rows[0].days7).toBe(2);
    expect(Number(rows[0].kcal7)).toBe(400 + 600 + 500);
    expect(Number(rows[0].goal_kcal)).toBe(1800);
    expect(rows[0].pending_swaps).toBe(0);
    expect(rows[0].unread_messages).toBe(0);
  });

  it('paciente parado há mais de 7 dias ainda mostra o último registro', async () => {
    await db.query(`DELETE FROM nutrition_log_entries WHERE user_id = $1 AND entry_date > app_today() - 10`, [PATIENT]);
    const row = await asUser(db, NUTRI, async (tx) =>
      (await tx.query<{ days7: number; last_log: string | null }>('SELECT days7, last_log::text FROM patients_overview()')).rows[0]
    );
    expect(row.days7).toBe(0);
    expect(row.last_log).not.toBeNull();
  });

  it('outro nutricionista não vê os pacientes de ninguém', async () => {
    const rows = await asUser(db, STRANGER, async (tx) => (await tx.query('SELECT * FROM patients_overview()')).rows);
    expect(rows).toHaveLength(0);
  });
});
