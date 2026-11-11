// Restos da auditoria (20261116120000_security_leftovers.sql): CRN revogado encerra vínculos,
// reserva atômica da demonstração e segredo no disparo das notificações.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-0000000006a1';
const PATIENT = '00000000-0000-4000-8000-0000000006a2';
const OTHER_PATIENT = '00000000-0000-4000-8000-0000000006a3';

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${PATIENT}'), ('${OTHER_PATIENT}');
    INSERT INTO profiles (id, full_name, user_type) VALUES
      ('${NUTRI}', 'Dra. Ana', 'Nutritionist'), ('${PATIENT}', 'Carla', 'Client'), ('${OTHER_PATIENT}', 'Diego', 'Client');
    UPDATE profiles SET crn_status = 'approved' WHERE id = '${NUTRI}';
  `);
}, 60000);

describe('CRN revogado', () => {
  const invite = () =>
    asUser(db, NUTRI, async (tx) => (await tx.query<{ code: string }>('SELECT * FROM create_nutritionist_invite()')).rows[0].code);
  const isMyPatient = () =>
    asUser(db, NUTRI, async (tx) => (await tx.query<{ ok: boolean }>('SELECT is_my_patient($1) AS ok', [PATIENT])).rows[0].ok);

  it('encerra os vínculos ativos, avisa o paciente e vence os convites em aberto', async () => {
    const used = await invite();
    await asUser(db, PATIENT, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [used]));
    const open = await invite();
    expect(await isMyPatient()).toBe(true);

    await db.query(`UPDATE profiles SET crn_status = 'rejected' WHERE id = $1`, [NUTRI]);

    expect(await isMyPatient()).toBe(false);
    const link = (await db.query<{ status: string; ended_at: string | null }>(
      'SELECT status, ended_at FROM nutritionist_clients WHERE client_id = $1', [PATIENT])).rows[0];
    expect(link.status).toBe('ended');
    expect(link.ended_at).not.toBeNull();
    const kinds = (await db.query<{ kind: string }>('SELECT kind FROM notifications WHERE user_id = $1', [PATIENT])).rows.map((r) => r.kind);
    expect(kinds).toContain('link_ended');
    await expect(asUser(db, OTHER_PATIENT, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [open]))).rejects.toThrow('invalid_invite');
  });

  it('aprovar de novo não reabre o vínculo: precisa de convite novo', async () => {
    await db.query(`UPDATE profiles SET crn_status = 'approved' WHERE id = $1`, [NUTRI]);
    expect(await isMyPatient()).toBe(false);
    const code = await invite();
    await asUser(db, PATIENT, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [code]));
    expect(await isMyPatient()).toBe(true);
  });

  it('mudar outra coluna do perfil não mexe no vínculo', async () => {
    await db.query(`UPDATE profiles SET full_name = 'Dra. Ana Lima' WHERE id = $1`, [NUTRI]);
    expect(await isMyPatient()).toBe(true);
  });
});

describe('demonstração: reserva atômica', () => {
  const claim = async (ip: string, perIp = 2, perDay = 3) =>
    (await db.query<{ ok: boolean }>('SELECT claim_demo_start($1, $2, $3) AS ok', [ip, perIp, perDay])).rows[0].ok;

  it('para no limite por visitante e no limite do dia', async () => {
    expect(await claim('a')).toBe(true);
    expect(await claim('a')).toBe(true);
    expect(await claim('a')).toBe(false);
    expect(await claim('b')).toBe(true);
    expect(await claim('c')).toBe(false);
  });

  it('tentativas antigas saem da conta', async () => {
    await db.query(`UPDATE demo_starts SET created_at = now() - interval '2 days'`);
    expect(await claim('c')).toBe(true);
    expect((await db.query('SELECT 1 FROM demo_starts')).rows).toHaveLength(1);
  });

  it('usuário logado não reserva nem lê a tabela', async () => {
    await expect(asUser(db, PATIENT, (tx) => tx.query(`SELECT claim_demo_start('x', 5, 100)`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, PATIENT, (tx) => tx.query('SELECT * FROM demo_starts'))).rejects.toThrow(/permission denied/);
  });
});

describe('disparo de notificação com segredo', () => {
  const headers = async () => {
    await db.query('DELETE FROM net.calls');
    await db.query(`SELECT notify($1, 'goals_updated', $1, '{}'::jsonb)`, [PATIENT]);
    return (await db.query<{ headers: Record<string, string> }>('SELECT headers FROM net.calls')).rows.map((r) => r.headers);
  };

  it('sem Vault (ou sem o segredo), envia como antes', async () => {
    await asUser(db, PATIENT, (tx) => tx.query(`SELECT save_push_subscription('https://fcm.googleapis.com/fcm/send/sec', 'k', 'a', 'teste')`));
    expect(await headers()).toEqual([{ 'Content-Type': 'application/json' }]);
  });

  it('com o segredo no Vault, manda no cabeçalho', async () => {
    await db.exec(`
      CREATE SCHEMA vault;
      CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
    `);
    expect(await headers()).toEqual([{ 'Content-Type': 'application/json' }]);
    await db.query(`INSERT INTO vault.decrypted_secrets VALUES ('push_webhook_secret', 's3gredo')`);
    expect(await headers()).toEqual([{ 'Content-Type': 'application/json', 'x-push-secret': 's3gredo' }]);
  });
});
