// Regras de segurança (20261027120000_security_hardening.sql): quem lê perfis, limite da IA,
// nota das receitas, inscrições de notificação e exclusão de conta com assinatura pendente.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-00000000001a';
const PRIVATE_NUTRI = '00000000-0000-4000-8000-00000000001b';
const PATIENT = '00000000-0000-4000-8000-00000000001c';
const STRANGER = '00000000-0000-4000-8000-00000000001d';
const REVIEWER = '00000000-0000-4000-8000-00000000001e';
const RECIPE = '00000000-0000-4000-8000-0000000001a1';

let db: PGlite;

const asAnon = <T,>(fn: (tx: Transaction) => Promise<T>) =>
  db.transaction(async (tx) => {
    await tx.exec('SET LOCAL ROLE anon');
    return fn(tx);
  });
const visibleIds = async (tx: Transaction) =>
  (await tx.query<{ id: string }>('SELECT id FROM profiles ORDER BY id')).rows.map((r) => r.id);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${PRIVATE_NUTRI}'), ('${PATIENT}'), ('${STRANGER}'), ('${REVIEWER}');
    INSERT INTO profiles (id, full_name, user_type, profile_visibility) VALUES
      ('${NUTRI}', 'Dra. Ana', 'Nutritionist', 'public'),
      ('${PRIVATE_NUTRI}', 'Dr. Bruno', 'Nutritionist', 'private'),
      ('${PATIENT}', 'Carla', 'Client', 'public'),
      ('${STRANGER}', 'Diego', 'Client', 'public'),
      ('${REVIEWER}', 'Elisa', 'Client', 'public');
    INSERT INTO recipes (id, title, author_id) VALUES ('${RECIPE}', 'Omelete', '${NUTRI}');
    INSERT INTO reviews (recipe_id, user_id, rating) VALUES ('${RECIPE}', '${REVIEWER}', 4);
    INSERT INTO nutritionist_clients (nutritionist_id, client_id, status) VALUES ('${PRIVATE_NUTRI}', '${PATIENT}', 'active');
  `);
});

describe('perfis (RLS)', () => {
  it('visitante vê só nutricionistas públicos e autores de receitas/avaliações, não a lista de pacientes', async () => {
    expect(await asAnon(visibleIds)).toEqual([NUTRI, REVIEWER]);
  });

  it('paciente vê o próprio perfil e o do seu nutricionista (mesmo privado), não outros pacientes', async () => {
    const ids = await asUser(db, PATIENT, visibleIds);
    expect(ids).toContain(PATIENT);
    expect(ids).toContain(PRIVATE_NUTRI);
    expect(ids).not.toContain(STRANGER);
  });

  it('nutricionista vê o paciente com acompanhamento ativo; outro usuário não', async () => {
    expect(await asUser(db, PRIVATE_NUTRI, visibleIds)).toContain(PATIENT);
    expect(await asUser(db, STRANGER, visibleIds)).not.toContain(PATIENT);
  });

  it('último acesso não é legível pelo app', async () => {
    await expect(asUser(db, PATIENT, (tx) => tx.query('SELECT last_seen FROM profiles'))).rejects.toThrow(/permission denied/);
  });
});

describe('limite da IA', () => {
  it('conta no servidor e recusa depois do limite da hora', async () => {
    const consume = async () =>
      (await db.query<{ ok: boolean }>(`SELECT consume_ai_quota('${PATIENT}', 'chat', 2, 10) AS ok`)).rows[0].ok;
    expect(await consume()).toBe(true);
    expect(await consume()).toBe(true);
    expect(await consume()).toBe(false);
    // Outro tipo de uso tem contagem própria.
    expect((await db.query<{ ok: boolean }>(`SELECT consume_ai_quota('${PATIENT}', 'photo', 2, 10) AS ok`)).rows[0].ok).toBe(true);
  });

  it('o app não consegue chamar a contagem nem ler os usos', async () => {
    await expect(asUser(db, PATIENT, (tx) => tx.query(`SELECT consume_ai_quota('${PATIENT}', 'chat', 99, 99)`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, PATIENT, (tx) => tx.query('SELECT * FROM ai_usage'))).rejects.toThrow(/permission denied/);
  });
});

describe('nota das receitas', () => {
  it('a nota vem das avaliações e o autor não consegue mudá-la', async () => {
    const rating = async () => Number((await db.query<{ rating: string }>(`SELECT rating FROM recipes WHERE id = '${RECIPE}'`)).rows[0].rating);
    expect(await rating()).toBe(4);
    await asUser(db, STRANGER, (tx) => tx.query(`INSERT INTO reviews (recipe_id, user_id, rating) VALUES ('${RECIPE}', '${STRANGER}', 5)`));
    expect(await rating()).toBe(4.5);
    await expect(asUser(db, NUTRI, (tx) => tx.query(`UPDATE recipes SET rating = 5 WHERE id = '${RECIPE}'`))).rejects.toThrow(/permission denied/);
    // O título continua editável pelo autor.
    await asUser(db, NUTRI, (tx) => tx.query(`UPDATE recipes SET title = 'Omelete de forno' WHERE id = '${RECIPE}'`));
  });
});

describe('inscrição de notificação', () => {
  it('só aceita serviços de notificação conhecidos', async () => {
    await expect(asUser(db, PATIENT, (tx) => tx.query(`SELECT save_push_subscription('https://evil.example/x', 'k', 'a', '')`))).rejects.toThrow(/invalid_endpoint/);
    await expect(asUser(db, PATIENT, (tx) => tx.query(`SELECT save_push_subscription('http://fcm.googleapis.com/fcm/send/x', 'k', 'a', '')`))).rejects.toThrow(/invalid_endpoint/);
    await asUser(db, PATIENT, (tx) => tx.query(`SELECT save_push_subscription('https://fcm.googleapis.com/fcm/send/x', 'k', 'a', '')`));
    await asUser(db, PATIENT, (tx) => tx.query(`SELECT save_push_subscription('https://wns2-bl2p.notify.windows.com/w/?token=x', 'k', 'a', '')`));
  });
});

describe('excluir a conta', () => {
  it('com assinatura de pagamento pendente, recusa', async () => {
    await db.exec(`INSERT INTO user_subscriptions (user_id, status, stripe_subscription_id, auto_renew) VALUES ('${STRANGER}', 'pending', 'sub_x', false)`);
    await expect(asUser(db, STRANGER, (tx) => tx.query('SELECT delete_my_account()'))).rejects.toThrow(/active_subscription/);
  });
});

describe('verificação do CRN', () => {
  const NEW_NUTRI = '00000000-0000-4000-8000-00000000002a';
  const ADMIN = '00000000-0000-4000-8000-00000000002b';
  const submit = (uid: string, card = `${uid}/card.webp`) =>
    asUser(db, uid, (tx) =>
      tx.query(`SELECT submit_crn_verification('Fulana de Tal', 3::smallint, '12.345', $1, $2)`, [card, `${uid}/selfie.webp`])
    );
  const status = async (uid: string) =>
    (await db.query<{ crn_status: string; crn_number: string | null }>(`SELECT crn_status, crn_number FROM profiles WHERE id = $1`, [uid])).rows[0];

  beforeAll(async () => {
    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('${NEW_NUTRI}'), ('${ADMIN}');
      INSERT INTO profiles (id, full_name, user_type) VALUES ('${NEW_NUTRI}', 'Fulana', 'Nutritionist'), ('${ADMIN}', 'Admin', 'Client');
      INSERT INTO app_admins (user_id) VALUES ('${ADMIN}');
    `);
  });

  it('sem CRN aprovado, o nutricionista não cria convite', async () => {
    expect((await status(NEW_NUTRI)).crn_status).toBe('none');
    await expect(asUser(db, NEW_NUTRI, (tx) => tx.query('SELECT create_nutritionist_invite()'))).rejects.toThrow(/crn_not_verified/);
  });

  it('envio só com fotos da própria pasta; paciente não envia; o administrador recebe aviso', async () => {
    await expect(submit(NEW_NUTRI, `${PATIENT}/card.webp`)).rejects.toThrow(/invalid_files/);
    await expect(submit(PATIENT)).rejects.toThrow(/only_nutritionists/);
    await submit(NEW_NUTRI);
    expect((await status(NEW_NUTRI)).crn_status).toBe('pending');
    const n = await asUser(db, ADMIN, async (tx) => (await tx.query<{ kind: string; data: { crn: string } }>('SELECT kind, data FROM notifications')).rows);
    expect(n).toEqual([expect.objectContaining({ kind: 'verification_requested', data: expect.objectContaining({ crn: 'CRN-3 12345' }) })]);
  });

  it('só o administrador vê os pedidos e aprova; quem não é admin não consegue', async () => {
    expect((await asUser(db, STRANGER, (tx) => tx.query('SELECT * FROM nutritionist_verifications'))).rows).toHaveLength(0);
    expect((await asUser(db, ADMIN, (tx) => tx.query('SELECT * FROM nutritionist_verifications'))).rows).toHaveLength(1);
    await expect(asUser(db, NEW_NUTRI, (tx) => tx.query(`SELECT review_crn_verification('${NEW_NUTRI}', true, '')`))).rejects.toThrow(/not_allowed/);
    await expect(asUser(db, ADMIN, (tx) => tx.query(`SELECT review_crn_verification('${NEW_NUTRI}', false, '')`))).rejects.toThrow(/reason_required/);
    await asUser(db, ADMIN, (tx) => tx.query(`SELECT review_crn_verification('${NEW_NUTRI}', true, '')`));
    expect(await status(NEW_NUTRI)).toEqual({ crn_status: 'approved', crn_number: '12345' });
    await asUser(db, NEW_NUTRI, (tx) => tx.query('SELECT create_nutritionist_invite()'));
    const n = await asUser(db, NEW_NUTRI, async (tx) => (await tx.query<{ kind: string; data: { approved: boolean } }>('SELECT kind, data FROM notifications')).rows);
    expect(n).toEqual([expect.objectContaining({ kind: 'verification_reviewed', data: expect.objectContaining({ approved: true }) })]);
  });

  it('o próprio nutricionista não muda o status do CRN', async () => {
    await expect(asUser(db, PRIVATE_NUTRI, (tx) => tx.query(`UPDATE profiles SET crn_status = 'approved' WHERE id = '${PRIVATE_NUTRI}'`))).rejects.toThrow(/permission denied/);
  });
});
