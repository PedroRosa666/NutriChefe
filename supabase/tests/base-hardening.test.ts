// Etapa 1 do plano (20261104120000_base_hardening.sql): tabelas antigas fora da API, permissões
// enxutas, metas sem "definida por" falso e operações repetíveis sem duplicar.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const PATIENT = '00000000-0000-4000-8000-0000000000b1';
const OTHER = '00000000-0000-4000-8000-0000000000b2';
const NUTRI = '00000000-0000-4000-8000-0000000000b3';
let db: PGlite;

const hasPrivilege = (role: string, table: string, privilege: string) =>
  db
    .query<{ ok: boolean }>(`SELECT has_table_privilege($1, $2, $3) AS ok`, [role, table, privilege])
    .then((r) => r.rows[0].ok);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${PATIENT}'), ('${OTHER}'), ('${NUTRI}');
    INSERT INTO profiles (id, full_name, user_type) VALUES
      ('${PATIENT}', 'Paciente', 'Client'), ('${OTHER}', 'Outra', 'Client'), ('${NUTRI}', 'Nutri', 'Nutritionist');
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${NUTRI}', '${PATIENT}', 'active');
  `);
});

describe('tabelas antigas', () => {
  // Saíram do public aqui (schema legacy) e foram apagadas em 20261112120000_cleanup_privacy_limit.sql.
  it('não existem mais, nem no public nem no legacy', async () => {
    const r = await db.query<{ pub: string | null; leg: string | null }>(
      `SELECT to_regclass('public.messages')::text AS pub, to_regnamespace('legacy')::text AS leg`
    );
    expect(r.rows[0]).toEqual({ pub: null, leg: null });
  });
});

describe('permissões da API', () => {
  it('ninguém da API pode TRUNCATE; visitante não grava', async () => {
    expect(await hasPrivilege('authenticated', 'public.meal_plans', 'TRUNCATE')).toBe(false);
    expect(await hasPrivilege('anon', 'public.meal_plans', 'INSERT')).toBe(false);
    expect(await hasPrivilege('anon', 'public.favorites', 'DELETE')).toBe(false);
    // O registro de erros da tela continua aberto a visitantes.
    expect(await hasPrivilege('anon', 'public.client_errors', 'INSERT')).toBe(true);
  });

  it('assinatura não muda pela API', async () => {
    expect(await hasPrivilege('authenticated', 'public.user_subscriptions', 'UPDATE')).toBe(false);
    expect(await hasPrivilege('authenticated', 'public.user_subscriptions', 'INSERT')).toBe(false);
  });

  it('tabela criada depois já nasce sem TRUNCATE e sem escrita de visitante', async () => {
    await db.exec(`CREATE TABLE public.future_table (id int)`);
    expect(await hasPrivilege('authenticated', 'public.future_table', 'TRUNCATE')).toBe(false);
    expect(await hasPrivilege('anon', 'public.future_table', 'INSERT')).toBe(false);
    await db.exec(`DROP TABLE public.future_table`);
  });

  it('função de gatilho não é rota da API', async () => {
    const r = await db.query<{ ok: boolean }>(
      `SELECT bool_or(has_function_privilege('authenticated', p.oid, 'execute')) AS ok
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype`
    );
    expect(r.rows[0].ok).toBe(false);
  });
});

describe('metas: quem definiu', () => {
  it('o paciente não grava outra pessoa como autora das metas', async () => {
    await expect(
      asUser(db, PATIENT, (tx) =>
        tx.query(`INSERT INTO nutrition_goals (user_id, calories, set_by) VALUES ($1, 1800, $2)`, [PATIENT, OTHER])
      )
    ).rejects.toThrow(/not_allowed/);
  });

  it('as metas do nutricionista ficam com ele; o paciente pode trocar pelas próprias (set_by vazio)', async () => {
    await asUser(db, NUTRI, (tx) =>
      tx.query(`INSERT INTO nutrition_goals (user_id, calories, set_by) VALUES ($1, 1700, $2)`, [PATIENT, NUTRI])
    );
    // Mudar outra coisa mantém o autor.
    await asUser(db, PATIENT, (tx) => tx.query(`UPDATE nutrition_goals SET protein = 90 WHERE user_id = $1`, [PATIENT]));
    expect((await db.query<{ set_by: string }>(`SELECT set_by FROM nutrition_goals WHERE user_id = $1`, [PATIENT])).rows[0].set_by).toBe(NUTRI);
    await asUser(db, PATIENT, (tx) => tx.query(`UPDATE nutrition_goals SET calories = 2000, set_by = NULL WHERE user_id = $1`, [PATIENT]));
    expect((await db.query<{ set_by: string | null }>(`SELECT set_by FROM nutrition_goals WHERE user_id = $1`, [PATIENT])).rows[0].set_by).toBeNull();
  });
});

describe('operações repetíveis', () => {
  const OP = '00000000-0000-4000-8000-0000000000f1';
  const begin = (uid: string, payload: object, kind = 'test') =>
    asUser(db, uid, (tx) =>
      tx.query<{ r: unknown }>(`SELECT op_begin($1, $2, $3::jsonb) AS r`, [OP, kind, JSON.stringify(payload)]).then((r) => r.rows[0].r)
    );

  it('primeira vez reserva; repetir devolve o resultado guardado', async () => {
    await asUser(db, PATIENT, async (tx) => {
      const first = await tx.query<{ r: unknown }>(`SELECT op_begin($1, 'test', '{"a":1}') AS r`, [OP]);
      expect(first.rows[0].r).toBeNull();
      await tx.query(`SELECT op_finish($1, '{"saved":true}')`, [OP]);
    });
    expect(await begin(PATIENT, { a: 1 })).toEqual({ saved: true });
  });

  it('mesmo id com outro conteúdo, outro tipo ou outra pessoa: conflito', async () => {
    await expect(begin(PATIENT, { a: 2 })).rejects.toThrow(/operation_conflict/);
    await expect(begin(PATIENT, { a: 1 }, 'other')).rejects.toThrow(/operation_conflict/);
    await expect(begin(OTHER, { a: 1 })).rejects.toThrow(/operation_conflict/);
  });

  it('se a gravação falha, a reserva some junto e dá para tentar de novo', async () => {
    const OP2 = '00000000-0000-4000-8000-0000000000f2';
    await expect(
      asUser(db, PATIENT, async (tx) => {
        await tx.query(`SELECT op_begin($1, 'test', '{}')`, [OP2]);
        throw new Error('falhou no meio');
      })
    ).rejects.toThrow('falhou no meio');
    const again = await asUser(db, PATIENT, (tx) => tx.query<{ r: unknown }>(`SELECT op_begin($1, 'test', '{}') AS r`, [OP2]));
    expect(again.rows[0].r).toBeNull();
  });
});
