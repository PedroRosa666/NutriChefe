/** Supabase Edge Function: demo
 *
 * Demonstração pública (/demo), para quem recebe o link testar o app sem cadastro:
 *   { action: "start", as: "patient" | "nutritionist" } -> cria um par novo (paciente + nutricionista,
 *                                                          vinculados e com dados) e devolve o token
 *   { action: "switch" }                                 -> (logado numa conta do par) token da outra conta
 * O par vale 24 horas; os vencidos são apagados aqui mesmo, a cada par novo. As travas do que o
 * visitante não pode fazer estão no banco (20261110120000_demo_visitors.sql).
 * Publicada com verify_jwt = false: "start" é para quem não tem conta.
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

// Pares novos por visitante (IP) por hora e no total por dia.
const PER_IP_HOUR = 5;
const PER_DAY = Number(Deno.env.get("DEMO_DAILY_LIMIT") || 100);

async function ipHash(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  // Com sal secreto: o hash não serve para descobrir o IP.
  const salt = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").slice(-16);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function countSince(supabase: any, since: Date, ip?: string): Promise<number> {
  let query = supabase.from("demo_visitors").select("id", { count: "exact", head: true }).gt("created_at", since.toISOString());
  if (ip) query = query.eq("ip_hash", ip);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function removePair(supabase: any, row: { id: string; patient_id: string; nutritionist_id: string }) {
  // Paciente primeiro: os dados dela (plano, mensagens) apontam para a nutricionista.
  await deleteUser(supabase, row.patient_id);
  await deleteUser(supabase, row.nutritionist_id);
  await supabase.from("demo_visitors").delete().eq("id", row.id);
}

async function cleanupExpired(supabase: any) {
  const { data } = await supabase.from("demo_visitors").select("id, patient_id, nutritionist_id")
    .lt("expires_at", new Date().toISOString()).order("expires_at").limit(10);
  for (const row of data ?? []) {
    await removePair(supabase, row).catch((err: any) => console.error("demo cleanup failed", row.id, err?.message));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = await req.json().catch(() => ({}));

    if (body.action === "start") {
      const as = body.as === "nutritionist" ? "nutritionist" : "patient";
      const ip = await ipHash(req);
      if (await countSince(supabase, new Date(Date.now() - 3600_000), ip) >= PER_IP_HOUR) {
        return reply({ ok: false, error: "rate_limited" });
      }
      if (await countSince(supabase, new Date(Date.now() - 86400_000)) >= PER_DAY) {
        return reply({ ok: false, error: "rate_limited" });
      }
      await cleanupExpired(supabase);

      const tag = crypto.randomUUID();
      let patient: string | null = null;
      let nutri: string | null = null;
      try {
        patient = await createDemoUser(supabase, `visitante.${tag}.p@example.com`, "Paciente Demo", "Client");
        nutri = await createDemoUser(supabase, `visitante.${tag}.n@example.com`, "Nutricionista Demo", "Nutritionist");
        // Antes da semente: as travas do banco já valem desde o primeiro dado.
        const { error: rowError } = await supabase.from("demo_visitors").insert({ patient_id: patient, nutritionist_id: nutri, ip_hash: ip });
        if (rowError) throw rowError;
        const { error } = await supabase.rpc("seed_demo_data", { p_patient: patient, p_nutri: nutri });
        if (error) throw error;
        // IA da paciente e recursos Premium da nutricionista (a IA para em 5 usos do par).
        await setDemoPremium(supabase, patient, "ai_mentoring", true);
        await setDemoPremium(supabase, nutri, "nutritionist_pro", true);
      } catch (err) {
        await deleteUser(supabase, patient).catch(() => undefined);
        await deleteUser(supabase, nutri).catch(() => undefined);
        await supabase.from("demo_visitors").delete().eq("patient_id", patient ?? "");
        throw err;
      }

      const token_hash = await loginToken(supabase, as === "nutritionist" ? nutri! : patient!);
      if (!token_hash) return reply({ ok: false, error: "error" });
      return reply({ ok: true, token_hash });
    }

    if (body.action === "switch") {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return reply({ ok: false, error: "unauthenticated" });
      const { data: row } = await supabase.from("demo_visitors").select("patient_id, nutritionist_id")
        .or(`patient_id.eq.${user.id},nutritionist_id.eq.${user.id}`).maybeSingle();
      if (!row) return reply({ ok: false, error: "not_allowed" });
      const other = row.patient_id === user.id ? row.nutritionist_id : row.patient_id;
      const token_hash = await loginToken(supabase, other);
      if (!token_hash) return reply({ ok: false, error: "expired" });
      return reply({ ok: true, token_hash });
    }

    return reply({ ok: false, error: "bad_request" });
  } catch (err: any) {
    console.error("demo error", err);
    return reply({ ok: false, error: "error" });
  }
});
