/** Supabase Edge Function: admin
 *
 * Ações do painel do administrador que precisam da API de Auth (service role):
 *   { action: "suspend", user_id, suspend }        -> suspende/reativa a conta (bloqueia o login)
 *   { action: "demo_status" }                       -> contas demo do administrador e o estado delas
 *   { action: "demo_reset" }                        -> (re)cria a paciente demo e a nutricionista demo com dados
 *   { action: "demo_login", as: "patient" | "nutritionist" } -> token para entrar na conta demo
 *   { action: "demo_toggle", what, on }             -> Premium das contas demo, CRN pendente, limite de pacientes
 *   { action: "simulate", what: "swap" | "message" } -> pedido de troca / mensagem da paciente demo
 * Só administradores (tabela app_admins). As contas demo nunca aparecem para outros usuários.
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import { createDemoUser, deleteUser, loginToken, setDemoPremium } from "../_shared/demo-accounts.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (data: Record<string, unknown>) => new Response(JSON.stringify(data), { status: 200, headers: cors });

const demoEmail = (kind: string, adminId: string) => `demo.${kind}.${adminId.slice(0, 8)}@example.com`;

async function demoRow(supabase: any, adminId: string) {
  const { data } = await supabase.from("admin_demo_accounts").select("*").eq("admin_id", adminId).maybeSingle();
  return data;
}

async function hasActivePremium(supabase: any, userId: string, feature: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_feature", { p_user: userId, p_feature: feature });
  return data === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return reply({ ok: false, error: "unauthenticated" });

    const body = await req.json().catch(() => ({}));

    // Voltar ao admin é feito no app (sessão guardada); aqui só administradores entram.
    const { data: admin } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return reply({ ok: false, error: "not_allowed" });

    switch (body.action) {
      case "suspend": {
        const target = String(body.user_id ?? "");
        if (!target || target === user.id) return reply({ ok: false, error: "invalid_user" });
        const { data: other } = await supabase.from("app_admins").select("user_id").eq("user_id", target).maybeSingle();
        if (other) return reply({ ok: false, error: "cannot_suspend_admin" });
        const { error } = await supabase.auth.admin.updateUserById(target, { ban_duration: body.suspend ? "876000h" : "none" });
        if (error) throw error;
        return reply({ ok: true });
      }

      case "demo_status": {
        const row = await demoRow(supabase, user.id);
        if (!row?.patient_id || !row?.nutritionist_id) return reply({ ok: true, exists: false });
        const { data: nutri } = await supabase.from("profiles").select("crn_status").eq("id", row.nutritionist_id).maybeSingle();
        return reply({
          ok: true,
          exists: true,
          patientPremium: await hasActivePremium(supabase, row.patient_id, "ai_mentoring"),
          nutritionistPremium: await hasActivePremium(supabase, row.nutritionist_id, "nutritionist_pro"),
          crnPending: nutri?.crn_status === "pending",
          atLimit: (row.extra_patients ?? []).length > 0,
        });
      }

      case "demo_reset": {
        const row = await demoRow(supabase, user.id);
        for (const id of [row?.patient_id, row?.nutritionist_id, ...(row?.extra_patients ?? [])]) await deleteUser(supabase, id);
        // Contas antigas com o mesmo e-mail (de um reset que falhou no meio).
        const { data: list } = await supabase.auth.admin.listUsers({ perPage: 200 });
        for (const u of list?.users ?? []) {
          if (u.email?.startsWith("demo.") && u.email.endsWith(`.${user.id.slice(0, 8)}@example.com`)) await deleteUser(supabase, u.id);
        }
        const patient = await createDemoUser(supabase, demoEmail("paciente", user.id), "Paciente Demo", "Client");
        const nutri = await createDemoUser(supabase, demoEmail("nutri", user.id), "Nutricionista Demo", "Nutritionist");
        const { error } = await supabase.rpc("admin_seed_demo", { p_admin: user.id, p_patient: patient, p_nutri: nutri });
        if (error) throw error;
        return reply({ ok: true });
      }

      case "demo_login": {
        const row = await demoRow(supabase, user.id);
        const id = body.as === "nutritionist" ? row?.nutritionist_id : row?.patient_id;
        if (!id) return reply({ ok: false, error: "no_demo" });
        const token_hash = await loginToken(supabase, id);
        if (!token_hash) return reply({ ok: false, error: "no_demo" });
        return reply({ ok: true, token_hash });
      }

      case "demo_toggle": {
        const row = await demoRow(supabase, user.id);
        if (!row?.patient_id || !row?.nutritionist_id) return reply({ ok: false, error: "no_demo" });
        const on = body.on === true;
        if (body.what === "patient_premium") await setDemoPremium(supabase, row.patient_id, "ai_mentoring", on);
        else if (body.what === "nutritionist_premium") await setDemoPremium(supabase, row.nutritionist_id, "nutritionist_pro", on);
        else if (body.what === "crn") {
          await supabase.from("profiles").update({ crn_status: on ? "pending" : "approved" }).eq("id", row.nutritionist_id);
        } else if (body.what === "limit") {
          // No limite do plano grátis: 4 pacientes demo extras (5 com a paciente demo).
          for (const id of row.extra_patients ?? []) await deleteUser(supabase, id);
          const extras: string[] = [];
          if (on) {
            for (let i = 1; i <= 4; i++) {
              const id = await createDemoUser(supabase, demoEmail(`extra${i}`, user.id), `Paciente Extra ${i}`, "Client");
              await supabase.from("nutritionist_clients").insert({ nutritionist_id: row.nutritionist_id, client_id: id, status: "active", consent_at: new Date().toISOString() });
              extras.push(id);
            }
          }
          await supabase.from("admin_demo_accounts").update({ extra_patients: extras }).eq("admin_id", user.id);
        } else return reply({ ok: false, error: "bad_request" });
        return reply({ ok: true });
      }

      case "simulate": {
        const row = await demoRow(supabase, user.id);
        if (!row?.patient_id || !row?.nutritionist_id) return reply({ ok: false, error: "no_demo" });
        if (body.what === "message") {
          const { error } = await supabase.from("care_messages").insert({
            nutritionist_id: row.nutritionist_id,
            client_id: row.patient_id,
            sender_id: row.patient_id,
            body: "Mensagem de teste do Laboratório: tudo certo com o plano?",
          });
          if (error) throw error;
        } else if (body.what === "swap") {
          const { data: plan } = await supabase.from("meal_plans").select("id").eq("client_id", row.patient_id).eq("created_by", row.nutritionist_id).limit(1).maybeSingle();
          if (!plan) return reply({ ok: false, error: "no_plan" });
          const { data: item } = await supabase.from("meal_plan_items").select("day, meal, recipe_id, recipes(title)").eq("plan_id", plan.id).not("recipe_id", "is", null).limit(1).maybeSingle();
          if (!item) return reply({ ok: false, error: "no_plan" });
          await supabase.from("food_swap_requests").update({ status: "canceled" }).eq("client_id", row.patient_id).eq("status", "pending");
          const { error } = await supabase.from("food_swap_requests").insert({
            plan_id: plan.id,
            client_id: row.patient_id,
            nutritionist_id: row.nutritionist_id,
            day: item.day,
            meal: item.meal,
            original_recipe_id: item.recipe_id,
            original_label: (item as any).recipes?.title ?? "Receita",
            requested_label: "Algo mais leve",
            reason: "Pedido de teste do Laboratório.",
            status: "pending",
          });
          if (error) throw error;
        } else return reply({ ok: false, error: "bad_request" });
        return reply({ ok: true });
      }

      default:
        return reply({ ok: false, error: "bad_request" });
    }
  } catch (err: any) {
    console.error("admin error", err);
    return reply({ ok: false, error: err?.message ?? "error" });
  }
});
