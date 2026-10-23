// Regras do banco que o app depende: convite, quem vê o quê (RLS), trocas e avisos.
// Cada teste roda como um usuário logado de verdade (papel authenticated + auth.uid()).
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb } from './harness';

const NUTRI = '00000000-0000-4000-8000-00000000000a';
const OTHER_NUTRI = '00000000-0000-4000-8000-00000000000b';
const PATIENT = '00000000-0000-4000-8000-00000000000c';
const STRANGER = '00000000-0000-4000-8000-00000000000d';
const RECIPE_A = '00000000-0000-4000-8000-0000000000a1';
const RECIPE_B = '00000000-0000-4000-8000-0000000000a2';
const FOOD_TACO = '00000000-0000-4000-8000-0000000000f1';
const FOOD_MINE = '00000000-0000-4000-8000-0000000000f2';
const FOOD_OTHER = '00000000-0000-4000-8000-0000000000f3';

let db: PGlite;
let planId: string;

const one = async <T,>(tx: { query: PGlite['query'] }, sql: string, params: unknown[] = []) =>
  (await tx.query<T>(sql, params)).rows[0];
const notifications = (uid: string) =>
  asUser(db, uid, async (tx) => (await tx.query<{ kind: string; data: Record<string, unknown>; read_at: string | null }>(
    'SELECT kind, data, read_at FROM notifications ORDER BY created_at'
  )).rows);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${NUTRI}'), ('${OTHER_NUTRI}'), ('${PATIENT}'), ('${STRANGER}');
    INSERT INTO profiles (id, full_name, user_type) VALUES
      ('${NUTRI}', 'Dra. Ana', 'Nutritionist'),
      ('${OTHER_NUTRI}', 'Dr. Bruno', 'Nutritionist'),
      ('${PATIENT}', 'Carla', 'Client'),
      ('${STRANGER}', 'Diego', 'Client');
    UPDATE profiles SET crn_status = 'approved' WHERE user_type = 'Nutritionist';
    INSERT INTO recipes (id, title) VALUES ('${RECIPE_A}', 'Omelete'), ('${RECIPE_B}', 'Panqueca de aveia');
    INSERT INTO foods (id, taco_id, owner_id, name, category, kcal, protein, carbs, fat) VALUES
      ('${FOOD_TACO}', 1, NULL, 'Arroz', 'Cereais', 124, 2.6, 25.8, 1),
      ('${FOOD_MINE}', NULL, '${NUTRI}', 'Pão da casa', 'Cereais', 250, 9, 50, 3),
      ('${FOOD_OTHER}', NULL, '${OTHER_NUTRI}', 'Pão do outro', 'Cereais', 250, 9, 50, 3);
  `);
}, 60000);

describe('convite e vínculo', () => {
  it('paciente aceita o convite e o nutricionista recebe aviso', async () => {
    const invite = await asUser(db, NUTRI, (tx) => one<{ code: string }>(tx, 'SELECT * FROM create_nutritionist_invite()'));
    await asUser(db, PATIENT, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [invite.code]));
    expect((await notifications(NUTRI)).map((n) => n.kind)).toContain('patient_joined');
    const link = (await db.query<{ consent_at: string | null }>('SELECT consent_at FROM nutritionist_clients WHERE client_id = $1', [PATIENT])).rows[0];
    expect(link.consent_at).not.toBeNull();
  });

  it('cliente não cria convite; convite usado não vale de novo', async () => {
    await expect(asUser(db, PATIENT, (tx) => tx.query('SELECT * FROM create_nutritionist_invite()'))).rejects.toThrow('only_nutritionists');
    const invite = await asUser(db, NUTRI, (tx) => one<{ code: string }>(tx, 'SELECT * FROM create_nutritionist_invite()'));
    await asUser(db, STRANGER, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [invite.code]));
    await expect(asUser(db, PATIENT, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [invite.code]))).rejects.toThrow('invalid_invite');
    // Desfaz o vínculo extra para não atrapalhar os outros testes.
    await asUser(db, STRANGER, (tx) => tx.query(`UPDATE nutritionist_clients SET status = 'ended', ended_at = now() WHERE client_id = $1`, [STRANGER]));
  });
});

describe('alimentos próprios (RLS)', () => {
  const visible = (uid: string) =>
    asUser(db, uid, async (tx) => (await tx.query<{ id: string }>('SELECT id FROM foods ORDER BY name')).rows.map((r) => r.id).sort());

  it('paciente vê TACO + alimentos do próprio nutricionista, não os de outro', async () => {
    expect(await visible(PATIENT)).toEqual([FOOD_TACO, FOOD_MINE].sort());
  });

  it('sem vínculo, só a TACO', async () => {
    expect(await visible(STRANGER)).toEqual([FOOD_TACO]);
  });
});

describe('plano e trocas', () => {
  it('nutricionista cria o plano do paciente e o paciente recebe aviso', async () => {
    planId = await asUser(db, NUTRI, async (tx) => {
      const plan = await one<{ id: string }>(tx, 'INSERT INTO meal_plans (client_id, created_by, title) VALUES ($1, $2, $3) RETURNING id', [PATIENT, NUTRI, 'Semana 1']);
      await tx.query(
        `INSERT INTO meal_plan_items (plan_id, day, meal, recipe_id, servings) VALUES ($1, 0, 'breakfast', $2, 1)`,
        [plan.id, RECIPE_A]
      );
      await tx.query(
        `INSERT INTO meal_plan_items (plan_id, day, meal, food_id, grams, measure_label) VALUES ($1, 0, 'lunch', $2, 150, '150 g')`,
        [plan.id, FOOD_TACO]
      );
      return plan.id;
    });
    expect((await notifications(PATIENT)).map((n) => n.kind)).toContain('plan_updated');
  });

  it('quem não tem vínculo não vê o plano', async () => {
    const rows = await asUser(db, STRANGER, async (tx) => (await tx.query('SELECT id FROM meal_plans')).rows);
    expect(rows).toEqual([]);
  });

  const requestRecipeSwap = (uid: string, food: string | null = null) =>
    asUser(db, uid, (tx) =>
      tx.query(
        `SELECT request_food_swap($1, 0::smallint, 'breakfast', NULL, $2, NULL, 'Omelete — 1 porç.', $3, $4, $5, $6, 1.5, 'Não gosto de ovo')`,
        [planId, RECIPE_A, food, food ? 50 : null, food ? '50 g' : null, food ? null : RECIPE_B]
      )
    );

  it('só o paciente do plano pede troca, e só com alimento visível para ele', async () => {
    await expect(requestRecipeSwap(STRANGER)).rejects.toThrow('not_allowed');
    await expect(requestRecipeSwap(PATIENT, FOOD_OTHER)).rejects.toThrow('invalid_food');
  });

  it('paciente pede troca por receita; pedido repetido é recusado; nutricionista recebe aviso', async () => {
    await requestRecipeSwap(PATIENT);
    await expect(requestRecipeSwap(PATIENT)).rejects.toThrow('already_pending');
    const kinds = (await notifications(NUTRI)).map((n) => n.kind);
    expect(kinds).toContain('swap_requested');
  });

  it('outro nutricionista não responde; o do plano aprova e a receita entra no plano', async () => {
    const swapId = (await db.query<{ id: string }>(`SELECT id FROM food_swap_requests WHERE status = 'pending'`)).rows[0].id;
    await expect(
      asUser(db, OTHER_NUTRI, (tx) => tx.query('SELECT resolve_food_swap($1, true, $2, NULL, NULL, NULL, NULL, NULL)', [swapId, '']))
    ).rejects.toThrow('not_allowed');

    const applied = await asUser(db, NUTRI, (tx) =>
      one<{ resolve_food_swap: boolean }>(tx, 'SELECT resolve_food_swap($1, true, $2, NULL, NULL, NULL, NULL, NULL)', [swapId, 'Ok!'])
    );
    expect(applied.resolve_food_swap).toBe(true);

    const item = (await db.query<{ recipe_id: string; servings: string }>(
      `SELECT recipe_id, servings FROM meal_plan_items WHERE plan_id = $1 AND meal = 'breakfast'`, [planId]
    )).rows[0];
    expect(item.recipe_id).toBe(RECIPE_B);
    expect(Number(item.servings)).toBe(1.5);

    const patient = await notifications(PATIENT);
    expect(patient.find((n) => n.kind === 'swap_answered')?.data).toMatchObject({ status: 'approved', offered: false });
    // O aviso do pedido fica como lido para o nutricionista depois da resposta.
    expect((await notifications(NUTRI)).find((n) => n.kind === 'swap_requested')?.read_at).not.toBeNull();
  });

  it('recusa oferecendo um alimento próprio: o alimento entra no plano', async () => {
    await asUser(db, PATIENT, (tx) =>
      tx.query(
        `SELECT request_food_swap($1, 0::smallint, 'lunch', NULL, NULL, $2, 'Arroz — 150 g', NULL, NULL, NULL, NULL, NULL, 'Enjoei de arroz')`,
        [planId, FOOD_TACO]
      )
    );
    const swapId = (await db.query<{ id: string }>(`SELECT id FROM food_swap_requests WHERE status = 'pending'`)).rows[0].id;
    await asUser(db, NUTRI, (tx) =>
      tx.query(`SELECT resolve_food_swap($1, false, 'Tente este', $2, 80, '80 g', NULL, NULL)`, [swapId, FOOD_MINE])
    );
    const item = (await db.query<{ food_id: string; grams: string }>(
      `SELECT food_id, grams FROM meal_plan_items WHERE plan_id = $1 AND meal = 'lunch'`, [planId]
    )).rows[0];
    expect(item).toMatchObject({ food_id: FOOD_MINE });
    expect(Number(item.grams)).toBe(80);
    const answered = (await notifications(PATIENT)).filter((n) => n.kind === 'swap_answered');
    expect(answered.some((n) => n.data.status === 'rejected' && n.data.offered === true)).toBe(true);
  });

  it('paciente cancela o pedido e o aviso não lido some para o nutricionista', async () => {
    await requestRecipeSwap(PATIENT);
    const swapId = (await db.query<{ id: string }>(`SELECT id FROM food_swap_requests WHERE status = 'pending'`)).rows[0].id;
    await asUser(db, PATIENT, (tx) => tx.query('SELECT cancel_food_swap($1)', [swapId]));
    const pending = (await notifications(NUTRI)).filter((n) => n.kind === 'swap_requested' && !n.read_at);
    expect(pending).toEqual([]);
  });
});

describe('avisos (RLS)', () => {
  it('cada um vê só os próprios avisos e não consegue criar avisos', async () => {
    const seenByPatient = await asUser(db, PATIENT, async (tx) =>
      (await tx.query<{ user_id: string }>('SELECT user_id FROM notifications')).rows
    );
    expect(seenByPatient.length).toBeGreaterThan(0);
    expect(seenByPatient.every((n) => n.user_id === PATIENT)).toBe(true);
    await expect(
      asUser(db, PATIENT, (tx) => tx.query(`INSERT INTO notifications (user_id, kind) VALUES ($1, 'plan_updated')`, [NUTRI]))
    ).rejects.toThrow(/permission denied/);
  });

  it('marcar como lido funciona; mudar o conteúdo não', async () => {
    await asUser(db, PATIENT, (tx) => tx.query('UPDATE notifications SET read_at = now()'));
    expect((await notifications(PATIENT)).every((n) => n.read_at)).toBe(true);
    await expect(asUser(db, PATIENT, (tx) => tx.query(`UPDATE notifications SET kind = 'goals_updated'`))).rejects.toThrow(/permission denied/);
  });
});

describe('modelos (RLS)', () => {
  it('só o dono vê o modelo', async () => {
    await asUser(db, NUTRI, (tx) => tx.query(`INSERT INTO meal_plan_templates (owner_id, title) VALUES ($1, 'Base 1800')`, [NUTRI]));
    const mine = await asUser(db, NUTRI, async (tx) => (await tx.query('SELECT id FROM meal_plan_templates')).rows);
    const other = await asUser(db, OTHER_NUTRI, async (tx) => (await tx.query('SELECT id FROM meal_plan_templates')).rows);
    expect(mine).toHaveLength(1);
    expect(other).toHaveLength(0);
    await expect(
      asUser(db, OTHER_NUTRI, (tx) => tx.query(`INSERT INTO meal_plan_templates (owner_id, title) VALUES ($1, 'Roubado')`, [NUTRI]))
    ).rejects.toThrow(/row-level security/);
  });
});

describe('adesão ao plano', () => {
  const planId = async () => (await db.query<{ id: string }>('SELECT id FROM meal_plans LIMIT 1')).rows[0].id;
  const mark = (uid: string, plan: string, date: string, status = 'ate') =>
    asUser(db, uid, (tx) =>
      tx.query(`INSERT INTO meal_plan_checks (client_id, plan_id, check_date, meal, status) VALUES ($1, $2, $3::date, 'lunch', $4)`, [uid, plan, date, status])
    );

  it('paciente marca a refeição de hoje; o nutricionista do plano vê, outro não', async () => {
    await mark(PATIENT, await planId(), new Date().toISOString().slice(0, 10));
    const nutri = await asUser(db, NUTRI, async (tx) => (await tx.query('SELECT status FROM meal_plan_checks')).rows);
    const other = await asUser(db, OTHER_NUTRI, async (tx) => (await tx.query('SELECT status FROM meal_plan_checks')).rows);
    expect(nutri).toEqual([{ status: 'ate' }]);
    expect(other).toEqual([]);
  });

  it('mesma refeição no mesmo dia: uma marcação só (atualiza)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await expect(mark(PATIENT, await planId(), today, 'skipped')).rejects.toThrow(/duplicate|unique/);
    await asUser(db, PATIENT, (tx) => tx.query(`UPDATE meal_plan_checks SET status = 'other' WHERE check_date = $1::date`, [today]));
    const rows = await asUser(db, PATIENT, async (tx) => (await tx.query('SELECT status FROM meal_plan_checks')).rows);
    expect(rows).toEqual([{ status: 'other' }]);
  });

  it('não marca datas futuras nem em nome de outra pessoa', async () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await expect(mark(PATIENT, await planId(), future)).rejects.toThrow(/row-level security/);
    const plan = await planId();
    await expect(
      asUser(db, STRANGER, (tx) =>
        tx.query(`INSERT INTO meal_plan_checks (client_id, plan_id, check_date, meal, status) VALUES ($1, $2, current_date, 'dinner', 'ate')`, [PATIENT, plan])
      )
    ).rejects.toThrow(/row-level security/);
  });
});

describe('mensagens', () => {
  const send = (uid: string, body: string, nutri = NUTRI, client = PATIENT) =>
    asUser(db, uid, (tx) =>
      tx.query(`INSERT INTO care_messages (nutritionist_id, client_id, sender_id, body) VALUES ($1, $2, $3, $4)`, [nutri, client, uid, body])
    );
  const thread = (uid: string) =>
    asUser(db, uid, async (tx) => (await tx.query<{ body: string; read_at: string | null }>('SELECT body, read_at FROM care_messages ORDER BY created_at')).rows);

  it('as duas pontas conversam; quem recebe ganha aviso', async () => {
    await send(PATIENT, 'Posso trocar o arroz por batata?');
    await send(NUTRI, 'Pode sim!');
    expect((await thread(PATIENT)).map((m) => m.body)).toEqual(['Posso trocar o arroz por batata?', 'Pode sim!']);
    expect((await notifications(NUTRI)).map((n) => n.kind)).toContain('message');
    expect((await notifications(PATIENT)).map((n) => n.kind)).toContain('message');
  });

  it('quem não é do acompanhamento não lê nem escreve, nem em nome de outro', async () => {
    expect(await thread(OTHER_NUTRI)).toEqual([]);
    await expect(send(OTHER_NUTRI, 'oi', OTHER_NUTRI, PATIENT)).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, STRANGER, (tx) =>
        tx.query(`INSERT INTO care_messages (nutritionist_id, client_id, sender_id, body) VALUES ($1, $2, $2, 'x')`, [NUTRI, PATIENT])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('marcar como lida vale só para as mensagens recebidas, e ninguém edita mensagem', async () => {
    await asUser(db, PATIENT, (tx) => tx.query('SELECT mark_messages_read($1, $2)', [NUTRI, PATIENT]));
    const rows = await thread(PATIENT);
    expect(rows.map((m) => Boolean(m.read_at))).toEqual([false, true]);
    await expect(asUser(db, PATIENT, (tx) => tx.query(`UPDATE care_messages SET body = 'editado'`))).rejects.toThrow(/permission denied/);
  });
});

describe('agenda de consultas', () => {
  const save = (uid: string, startsIn: string, client = PATIENT, id: string | null = null) =>
    asUser(db, uid, (tx) =>
      one<{ save_appointment: string }>(
        tx,
        `SELECT save_appointment($1, $2, now() + $3::interval, 50::smallint, 'online', 'https://meet.example/x', '')`,
        [id, client, startsIn]
      )
    ).then((r) => r.save_appointment);
  const kinds = async (uid: string) => (await notifications(uid)).map((n) => n.kind);
  let id = '';

  it('nutritionista agenda; o paciente vê e recebe aviso; outro nutricionista não vê', async () => {
    id = await save(NUTRI, '3 days');
    const seen = await asUser(db, PATIENT, async (tx) => (await tx.query('SELECT mode FROM appointments')).rows);
    expect(seen).toEqual([{ mode: 'online' }]);
    expect(await kinds(PATIENT)).toContain('appointment_scheduled');
    expect(await asUser(db, OTHER_NUTRI, async (tx) => (await tx.query('SELECT id FROM appointments')).rows)).toEqual([]);
  });

  it('paciente não agenda; ninguém agenda no passado nem com quem não acompanha', async () => {
    await expect(save(PATIENT, '3 days')).rejects.toThrow('not_allowed');
    await expect(save(NUTRI, '-2 days')).rejects.toThrow('in_the_past');
    await expect(save(OTHER_NUTRI, '3 days')).rejects.toThrow('not_allowed');
  });

  it('lembrete de 1 dia e de 1 hora, uma vez cada, para os dois', async () => {
    const soon = await save(NUTRI, '30 minutes');
    // Marcada para daqui a menos de 1 dia: só falta o lembrete de 1 hora.
    expect(Number((await db.query<{ n: number }>('SELECT send_appointment_reminders() AS n')).rows[0].n)).toBe(1);
    expect(Number((await db.query<{ n: number }>('SELECT send_appointment_reminders() AS n')).rows[0].n)).toBe(0);
    expect(await kinds(NUTRI)).toContain('appointment_reminder');
    await asUser(db, NUTRI, (tx) => tx.query('SELECT cancel_appointment($1)', [soon]));
  });

  it('paciente cancela; o nutricionista recebe aviso; não dá para cancelar de novo', async () => {
    await asUser(db, PATIENT, (tx) => tx.query('SELECT cancel_appointment($1)', [id]));
    expect(await kinds(NUTRI)).toContain('appointment_canceled');
    await expect(asUser(db, PATIENT, (tx) => tx.query('SELECT cancel_appointment($1)', [id]))).rejects.toThrow('not_allowed');
  });

  it('o app não escreve direto na tabela', async () => {
    await expect(
      asUser(db, NUTRI, (tx) => tx.query(`INSERT INTO appointments (nutritionist_id, client_id, starts_at) VALUES ($1, $2, now())`, [NUTRI, PATIENT]))
    ).rejects.toThrow(/permission denied/);
  });

  it('consulta futura fica marcada para o teste do fim do acompanhamento', async () => {
    id = await save(NUTRI, '5 days');
    expect(id).toBeTruthy();
  });
});

// Pedido de troca aberto do paciente (usado antes de encerrar o acompanhamento).
const requestOpenSwap = async () => {
  const planId = (await db.query<{ id: string }>('SELECT id FROM meal_plans LIMIT 1')).rows[0].id;
  await asUser(db, PATIENT, (tx) =>
    tx.query(
      `SELECT request_food_swap($1, 0::smallint, 'dinner', NULL, NULL, $2, 'Arroz', NULL, NULL, NULL, NULL, NULL, 'Quero outra coisa')`,
      [planId, FOOD_TACO]
    )
  );
};

describe('fim do acompanhamento', () => {
  it('paciente encerra: nutricionista recebe aviso e deixa de ver o plano', async () => {
    await requestOpenSwap();
    await asUser(db, PATIENT, (tx) =>
      tx.query(`UPDATE nutritionist_clients SET status = 'ended', ended_at = now() WHERE client_id = $1 AND nutritionist_id = $2`, [PATIENT, NUTRI])
    );
    expect((await notifications(NUTRI)).map((n) => n.kind)).toContain('link_ended');
    const plans = await asUser(db, NUTRI, async (tx) => (await tx.query('SELECT id FROM meal_plans')).rows);
    expect(plans).toEqual([]);
  });

  it('consultas futuras são canceladas', async () => {
    const rows = await db.query<{ status: string }>(`SELECT status FROM appointments WHERE client_id = $1 AND starts_at > now()`, [PATIENT]);
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.status === 'canceled')).toBe(true);
  });

  it('as mensagens também ficam fechadas para os dois', async () => {
    const seen = await asUser(db, PATIENT, async (tx) => (await tx.query('SELECT id FROM care_messages')).rows);
    expect(seen).toEqual([]);
    await expect(
      asUser(db, PATIENT, (tx) => tx.query(`INSERT INTO care_messages (nutritionist_id, client_id, sender_id, body) VALUES ($1, $2, $2, 'oi')`, [NUTRI, PATIENT]))
    ).rejects.toThrow(/row-level security/);
  });

  it('o paciente também deixa de ver o plano, os itens e os pedidos de troca desse nutricionista', async () => {
    const seen = await asUser(db, PATIENT, async (tx) => ({
      plans: (await tx.query('SELECT id FROM meal_plans')).rows,
      items: (await tx.query('SELECT id FROM meal_plan_items')).rows,
      swaps: (await tx.query('SELECT id FROM food_swap_requests')).rows,
    }));
    expect(seen).toEqual({ plans: [], items: [], swaps: [] });
  });

  it('pedidos de troca em aberto são cancelados quando o acompanhamento acaba', async () => {
    const open = await db.query(`SELECT id FROM food_swap_requests WHERE client_id = $1 AND status = 'pending'`, [PATIENT]);
    expect(open.rows).toEqual([]);
  });

  it('ao voltar com o mesmo nutricionista, o plano volta a aparecer', async () => {
    const invite = await asUser(db, NUTRI, (tx) => one<{ code: string }>(tx, 'SELECT * FROM create_nutritionist_invite()'));
    await asUser(db, PATIENT, (tx) => tx.query('SELECT redeem_nutritionist_invite($1)', [invite.code]));
    const plans = await asUser(db, PATIENT, async (tx) => (await tx.query('SELECT id FROM meal_plans')).rows);
    expect(plans).toHaveLength(1);
    await asUser(db, PATIENT, (tx) =>
      tx.query(`UPDATE nutritionist_clients SET status = 'ended', ended_at = now() WHERE client_id = $1 AND nutritionist_id = $2`, [PATIENT, NUTRI])
    );
  });
});

describe('apagar a própria conta (LGPD)', () => {
  it('com assinatura ativa que renova, recusa', async () => {
    await db.query(`INSERT INTO user_subscriptions (user_id, status, stripe_subscription_id, auto_renew) VALUES ($1, 'active', 'sub_1', true)`, [PATIENT]);
    await expect(asUser(db, PATIENT, (tx) => tx.query('SELECT delete_my_account()'))).rejects.toThrow('active_subscription');
  });

  it('apaga o usuário e, em cascata, perfil, vínculos e avisos', async () => {
    await asUser(db, STRANGER, (tx) => tx.query('SELECT delete_my_account()'));
    const left = await db.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM profiles WHERE id = $1) + (SELECT count(*) FROM nutritionist_clients WHERE client_id = $1)
            + (SELECT count(*) FROM notifications WHERE user_id = $1) AS n`,
      [STRANGER]
    );
    expect(Number(left.rows[0].n)).toBe(0);
  });

  it('sem login, não faz nada', async () => {
    await expect(db.transaction(async (tx) => {
      await tx.exec('SET LOCAL ROLE anon');
      await tx.query('SELECT delete_my_account()');
    })).rejects.toThrow(/permission denied/);
  });
});

describe('registro de erros', () => {
  it('visitante grava erro, mas ninguém lê pelo app', async () => {
    await db.transaction(async (tx) => {
      await tx.exec('SET LOCAL ROLE anon');
      await tx.query(`INSERT INTO client_errors (message) VALUES ('Falhou ao abrir o plano')`);
    });
    await expect(asUser(db, NUTRI, (tx) => tx.query('SELECT * FROM client_errors'))).rejects.toThrow(/permission denied/);
  });

  it('não dá para gravar erro em nome de outro usuário', async () => {
    await expect(
      asUser(db, NUTRI, (tx) => tx.query(`INSERT INTO client_errors (user_id, message) VALUES ($1, 'x')`, [PATIENT]))
    ).rejects.toThrow(/row-level security/);
  });
});

describe('notificações no celular', () => {
  const calls = async () => (await db.query<{ body: { notification_id: string } }>('SELECT body FROM net.calls')).rows;

  it('sem aparelho inscrito, não chama o envio', async () => {
    await db.query('DELETE FROM net.calls');
    await db.query(`SELECT notify($1, 'goals_updated', $1, '{}'::jsonb)`, [OTHER_NUTRI]);
    expect(await calls()).toEqual([]);
  });

  it('com aparelho inscrito, chama o envio uma vez; o envio só é reivindicado uma vez', async () => {
    await asUser(db, OTHER_NUTRI, (tx) => tx.query(`SELECT save_push_subscription('https://fcm.googleapis.com/fcm/send/abc', 'k', 'a', 'teste')`));
    await db.query('DELETE FROM net.calls');
    await db.query(`SELECT notify($1, 'patient_joined', $1, '{}'::jsonb)`, [OTHER_NUTRI]);
    const sent = await calls();
    expect(sent).toHaveLength(1);
    const id = sent[0].body.notification_id;
    expect((await db.query('SELECT * FROM claim_push($1)', [id])).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM claim_push($1)', [id])).rows).toHaveLength(0);
  });

  it('a inscrição passa para quem logou depois no mesmo aparelho; ninguém vê a do outro', async () => {
    await asUser(db, NUTRI, (tx) => tx.query(`SELECT save_push_subscription('https://fcm.googleapis.com/fcm/send/abc', 'k2', 'a2', 'teste')`));
    const mine = await asUser(db, NUTRI, async (tx) => (await tx.query('SELECT endpoint FROM push_subscriptions')).rows);
    const other = await asUser(db, OTHER_NUTRI, async (tx) => (await tx.query('SELECT endpoint FROM push_subscriptions')).rows);
    expect(mine).toHaveLength(1);
    expect(other).toHaveLength(0);
  });

  it('o app não consegue reivindicar envio (só a função do servidor)', async () => {
    await expect(asUser(db, NUTRI, (tx) => tx.query(`SELECT * FROM claim_push(gen_random_uuid())`))).rejects.toThrow(/permission denied/);
  });
});
