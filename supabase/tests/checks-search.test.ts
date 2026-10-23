// "Comi" + diário numa operação só e busca sem acento (20261102130000_checks_search_billing.sql).
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const PATIENT = '00000000-0000-4000-8000-00000000004a';
let db: PGlite;
let plan: string;

const entry = (title: string) => ({ recipe_id: null, title, servings: 1, per_serving: { calories: 300, protein: 20, carbs: 30, fat: 10, fiber: 5 } });

const save = (status: string, entries = [entry('Omelete'), entry('Pão integral')]) =>
  asUser(db, PATIENT, (tx) =>
    tx.query(`SELECT * FROM save_meal_check($1, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'breakfast', $2, '[]', '', $3::jsonb)`, [
      plan,
      status,
      JSON.stringify(entries),
    ])
  );

const diary = () =>
  db.query<{ recipe_title: string; meal: string }>(`SELECT recipe_title, meal FROM nutrition_log_entries WHERE user_id = $1 ORDER BY recipe_title`, [PATIENT]).then((r) => r.rows);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${PATIENT}');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${PATIENT}', 'Paciente', 'Client');
  `);
  plan = (await db.query<{ id: string }>(`INSERT INTO meal_plans (client_id, created_by, title) VALUES ($1, $1, 'Minha semana') RETURNING id`, [PATIENT])).rows[0].id;
});

describe('"Comi" e diário juntos (F11)', () => {
  it('marcar, desmarcar e marcar de novo nunca duplica', async () => {
    await save('ate');
    await save('ate');
    expect(await diary()).toEqual([
      { recipe_title: 'Omelete', meal: 'breakfast' },
      { recipe_title: 'Pão integral', meal: 'breakfast' },
    ]);
    // Trocar para "pulei" tira o que o "Comi" tinha lançado.
    await save('skipped');
    expect(await diary()).toEqual([]);
    await save('ate', [entry('Tapioca')]);
    expect((await diary()).map((e) => e.recipe_title)).toEqual(['Tapioca']);
  });

  it('desmarcar apaga os lançamentos da marcação; os registros feitos à mão ficam', async () => {
    await db.query(`INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_title, servings, per_serving) VALUES ($1, current_date, 'Café', 1, '{}')`, [PATIENT]);
    await asUser(db, PATIENT, (tx) => tx.query(`DELETE FROM meal_plan_checks WHERE client_id = $1`, [PATIENT]));
    expect((await diary()).map((e) => e.recipe_title)).toEqual(['Café']);
  });

  it('falha no meio desfaz tudo: não fica "comi" sem diário', async () => {
    await expect(save('ate', [entry('Ok'), { ...entry('Ruim'), servings: 'muito' as unknown as number }])).rejects.toThrow();
    const checks = await db.query(`SELECT 1 FROM meal_plan_checks WHERE client_id = $1`, [PATIENT]);
    expect(checks.rows.length).toBe(0);
    expect((await diary()).map((e) => e.recipe_title)).toEqual(['Café']);
  });
});

describe('busca sem acento no banco (F19)', () => {
  it('ignora acento, maiúsculas e ordem das palavras', async () => {
    const match = async (text: string, q: string) =>
      (await db.query<{ m: boolean }>(`SELECT search_match($1, $2) AS m`, [text, q])).rows[0].m;
    expect(await match('Salmão à Toscana', 'salmao')).toBe(true);
    expect(await match('Salmão à Toscana', 'TOSCANA SALMÃO')).toBe(true);
    expect(await match('JOSÉ Silva jose@x.com', 'jose silva')).toBe(true);
    expect(await match('Salmão à Toscana', 'frango')).toBe(false);
    expect(await match('qualquer', '  ')).toBe(true);
  });
});
