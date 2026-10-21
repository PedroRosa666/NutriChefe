/** Supabase Edge Function: create-portal-session (portal do Stripe para gerenciar a assinatura) */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const reply = (data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status: 200, headers: cors });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "";
    if (!supabaseUrl || !supabaseKey || !stripeSecret || !frontendUrl) {
      return reply({ ok: false, error: "Servidor de pagamentos não configurado." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as any });

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return reply({ ok: false, error: "Faça login novamente." });

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return reply({ ok: false, error: "Nenhuma assinatura encontrada para esta conta." });
    }

    // Só volta para o próprio site.
    const body = await req.json().catch(() => ({}));
    let returnUrl = `${frontendUrl}/perfil`;
    try {
      if (body?.returnUrl && new URL(body.returnUrl).origin === new URL(frontendUrl).origin) {
        returnUrl = body.returnUrl;
      }
    } catch {
      /* URL inválida: usa a padrão */
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    return reply({ ok: true, url: session.url });
  } catch (err: any) {
    console.error("create-portal-session error", err);
    return reply({ ok: false, error: "Não foi possível abrir o portal de assinatura." });
  }
});
