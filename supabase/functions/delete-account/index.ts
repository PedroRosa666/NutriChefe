/** Supabase Edge Function: delete-account
 *
 * Apaga a conta de quem chama e, depois, os arquivos dela no Storage (foto de perfil, fotos de
 * receitas e documentos do CRN). O banco não consegue apagar arquivos (o Storage só aceita pela
 * API), então delete_my_account sozinho deixava as fotos para trás.
 *
 * A exclusão em si continua sendo delete_my_account, chamada com o token do próprio usuário: as
 * mesmas regras valem (recusa com assinatura ativa). Só depois que ela deu certo os arquivos saem.
 *   resposta: { ok: true } | { ok: false, error: "unauthenticated" | "active_subscription" | "unknown" }
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (data: Record<string, unknown>) => new Response(JSON.stringify(data), { status: 200, headers: cors });

// Todos guardam os arquivos numa pasta com o id do usuário (as políticas do Storage exigem).
const BUCKETS = ["avatars", "recipe-images", "nutritionist-docs"];

/** Caminhos de todos os arquivos dentro da pasta (subpastas incluídas). */
async function listAll(admin: any, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Pasta não tem id.
      if (item.id) paths.push(path);
      else paths.push(...(await listAll(admin, bucket, path)));
    }
    if (!data || data.length < 100) return paths;
  }
}

async function removeFiles(admin: any, userId: string) {
  for (const bucket of BUCKETS) {
    const paths = await listAll(admin, bucket, userId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authorization = req.headers.get("Authorization") || "";
    const { data: { user } } = await admin.auth.getUser(authorization.replace("Bearer ", ""));
    if (!user) return reply({ ok: false, error: "unauthenticated" });

    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const { error } = await asUser.rpc("delete_my_account");
    if (error) {
      return reply({ ok: false, error: error.message.includes("active_subscription") ? "active_subscription" : "unknown" });
    }

    // A conta já saiu: uma falha aqui não volta atrás, só fica no log para limpar depois.
    try {
      await removeFiles(admin, user.id);
    } catch (e) {
      console.error("delete-account: arquivos não removidos", user.id, (e as Error).message);
    }
    return reply({ ok: true });
  } catch (e) {
    console.error("delete-account:", (e as Error).message);
    return reply({ ok: false, error: "unknown" });
  }
});
