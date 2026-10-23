// Mentoria IA e notificações (20261102120000_ai_push_security.sql): os cenários da auditoria
// de 23/10/2026 (F01-F04) agora são barrados, e o uso normal continua funcionando.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const PRO_NUTRI = '00000000-0000-4000-8000-00000000003a';
const PATIENT = '00000000-0000-4000-8000-00000000003b';
const OTHER = '00000000-0000-4000-8000-00000000003c';
const PREMIUM = '00000000-0000-4000-8000-00000000003d';
const FREE = '00000000-0000-4000-8000-00000000003e';

let db: PGlite;

const createConversation = (uid: string, nutritionist: string | null) =>
  asUser(db, uid, (tx) =>
    tx.query<{ id: string }>(
      `INSERT INTO ai_conversations (client_id, nutritionist_id, title) VALUES ($1, $2, 'Nova conversa') RETURNING id`,
      [uid, nutritionist]
    )
  ).then((r) => r.rows[0].id);

const countMessages = (uid: string, conversation: string) =>
  asUser(db, uid, (tx) => tx.query(`SELECT 1 FROM ai_messages WHERE conversation_id = $1`, [conversation])).then((r) => r.rows.length);

beforeAll(async () => {
  db = await createTestDb();
  const users = [PRO_NUTRI, PATIENT, OTHER, PREMIUM, FREE];
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ${users.map((u) => `('${u}')`).join(', ')};
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${PRO_NUTRI}', 'Pro', 'Nutritionist'), ('${PATIENT}', 'Paciente', 'Client'),
      ('${OTHER}', 'Outro', 'Client'), ('${PREMIUM}', 'Premium', 'Client'), ('${FREE}', 'Grátis', 'Client');
    INSERT INTO subscription_plans (name, price, currency, billing_period, features) VALUES ('Premium', 19.9, 'BRL', 'monthly', '["ai_mentoring"]');
    INSERT INTO user_subscriptions (user_id, plan_id, status) SELECT '${PREMIUM}', id, 'active' FROM subscription_plans WHERE name = 'Premium';
    INSERT INTO user_subscriptions (user_id, plan_id, status) SELECT '${PRO_NUTRI}', id, 'active' FROM subscription_plans WHERE name = 'Premium Nutricionista';
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${PRO_NUTRI}', '${PATIENT}', 'active');
  `);
});

describe('criar conversa com a IA', () => {
  it('assinante e paciente de nutricionista Premium criam; quem não tem acesso, não', async () => {
    await createConversation(PREMIUM, null);
    await createConversation(PRO_NUTRI, null);
    // F04: o paciente incluído no plano do nutricionista era barrado.
    await createConversation(PATIENT, PRO_NUTRI);
    await expect(createConversation(FREE, null)).rejects.toThrow(/row-level security/);
    // Sem acompanhamento, não dá para se dizer paciente de um nutricionista Premium.
    await expect(createConversation(OTHER, PRO_NUTRI)).rejects.toThrow(/row-level security/);
  });
});

describe('participantes fixos e histórico verdadeiro', () => {
  it('ninguém troca o paciente da conversa nem escreve no histórico de outro (F02)', async () => {
    const own = await createConversation(PRO_NUTRI, null);
    await expect(
      asUser(db, PRO_NUTRI, (tx) => tx.query(`UPDATE ai_conversations SET client_id = $1 WHERE id = $2`, [OTHER, own]))
    ).rejects.toThrow(/permission denied/);

    const patientConv = await createConversation(PATIENT, PRO_NUTRI);
    await expect(
      asUser(db, PRO_NUTRI, (tx) =>
        tx.query(`INSERT INTO ai_messages (conversation_id, sender_type, content) VALUES ($1, 'ai', 'resposta falsa')`, [patientConv])
      )
    ).rejects.toThrow(/row-level security/);
    expect(await countMessages(OTHER, own)).toBe(0);
  });

  it('o titular continua conversando, renomeando e arquivando', async () => {
    const conv = await createConversation(PATIENT, PRO_NUTRI);
    await asUser(db, PATIENT, (tx) =>
      tx.query(`INSERT INTO ai_messages (conversation_id, sender_type, content) VALUES ($1, 'user', 'Oi'), ($1, 'ai', 'Olá!')`, [conv])
    );
    await asUser(db, PATIENT, (tx) => tx.query(`UPDATE ai_conversations SET title = 'Jantar leve', is_active = false WHERE id = $1`, [conv]));
    // Conversa arquivada não recebe mensagens novas.
    await expect(
      asUser(db, PATIENT, (tx) => tx.query(`INSERT INTO ai_messages (conversation_id, content) VALUES ($1, 'mais uma')`, [conv]))
    ).rejects.toThrow(/row-level security/);
    expect(await countMessages(PATIENT, conv)).toBe(2);
  });
});

describe('fim do acompanhamento', () => {
  it('o nutricionista deixa de ler as conversas do paciente com a IA (F03)', async () => {
    const conv = await createConversation(PATIENT, PRO_NUTRI);
    await asUser(db, PATIENT, (tx) => tx.query(`INSERT INTO ai_messages (conversation_id, content) VALUES ($1, 'Tenho refluxo')`, [conv]));
    expect(await countMessages(PRO_NUTRI, conv)).toBe(1);

    await db.query(`UPDATE nutritionist_clients SET status = 'ended', ended_at = now() WHERE client_id = $1`, [PATIENT]);
    expect(await countMessages(PRO_NUTRI, conv)).toBe(0);
    const convs = await asUser(db, PRO_NUTRI, (tx) => tx.query(`SELECT 1 FROM ai_conversations WHERE id = $1`, [conv]));
    expect(convs.rows.length).toBe(0);
    // O paciente continua com o próprio histórico.
    expect(await countMessages(PATIENT, conv)).toBe(1);
  });
});

describe('inscrição de notificação sem atalho (F01)', () => {
  it('gravar direto na tabela é recusado; a função continua valendo', async () => {
    await expect(
      asUser(db, FREE, (tx) =>
        tx.query(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, 'https://example.invalid/push', 'k', 'a')`, [FREE])
      )
    ).rejects.toThrow(/permission denied/);

    await asUser(db, FREE, (tx) => tx.query(`SELECT save_push_subscription('https://fcm.googleapis.com/fcm/send/free', 'k', 'a', '')`));
    await expect(
      asUser(db, FREE, (tx) => tx.query(`UPDATE push_subscriptions SET endpoint = 'http://127.0.0.1/x' WHERE user_id = $1`, [FREE]))
    ).rejects.toThrow(/permission denied/);
    // Nem quem grava com privilégio passa um endereço fora da lista.
    await expect(
      db.query(`UPDATE push_subscriptions SET endpoint = 'http://127.0.0.1/x' WHERE user_id = $1`, [FREE])
    ).rejects.toThrow(/push_subscriptions_endpoint_check/);

    const mine = await asUser(db, FREE, (tx) => tx.query(`SELECT endpoint FROM push_subscriptions`));
    expect(mine.rows.length).toBe(1);
    await asUser(db, FREE, (tx) => tx.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [FREE]));
  });
});
