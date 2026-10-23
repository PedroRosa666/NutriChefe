/** Supabase Edge Function: create-checkout-session (versão com erros SEMPRE 200) */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ok = (data: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers: cors });

// Detalhes técnicos vão só para o log da função, não para o navegador.
const fail = (msg: string, debug?: Record<string, unknown>) => {
  if (debug) console.error(msg, debug);
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 200, // <-- SEMPRE 200 para o cliente receber a msg
    headers: cors,
  });
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // ===== ENV =====
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "";

    if (!supabaseUrl) return fail("Missing env SUPABASE_URL");
    if (!supabaseKey) return fail("Missing env SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeSecret) return fail("Missing env STRIPE_SECRET_KEY");
    if (!frontendUrl) return fail("Missing env FRONTEND_URL");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as any });

    // ===== AUTH =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return fail("Missing Authorization header (Bearer <access_token>)");
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);
    if (userErr || !user) return fail("Not authenticated (invalid token)");

    // ===== BODY =====
    const body = await req.json().catch(() => ({}));
    const { priceId, planId, successUrl, cancelUrl } = body as any;

    // O preço sempre vem de um plano cadastrado (nunca um preço qualquer mandado pelo navegador).
    // `priceId` só é aceito se for o preço de um plano ativo.
    let planQuery = supabase.from("subscription_plans").select("id, stripe_price_id").not("stripe_price_id", "is", null);
    if (planId) planQuery = planQuery.eq("id", planId);
    else if (priceId) planQuery = planQuery.eq("stripe_price_id", priceId);
    else return fail("Missing priceId or planId");
    const { data: plan, error: planErr } = await planQuery.limit(1).maybeSingle();
    if (planErr) return fail("Plan lookup failed", { planErr: planErr.message, planId, priceId });
    if (!plan?.stripe_price_id) return fail("Plano não encontrado.", { planId, priceId });
    const selectedPriceId = plan.stripe_price_id as string;

    // Evita cobrança em dobro: quem já tem assinatura paga ativa vai para o portal.
    const { data: activeSub } = await supabase
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("stripe_subscription_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (activeSub) {
      return fail("Você já tem uma assinatura ativa. Gerencie-a pelo seu perfil.");
    }

    // ===== PROFILE / CUSTOMER =====
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Só aceita URLs de retorno do próprio site (evita redirecionamento para domínio externo).
    const sameOrigin = (url: unknown): string | undefined => {
      if (typeof url !== "string") return undefined;
      try {
        return new URL(url).origin === new URL(frontendUrl).origin ? url : undefined;
      } catch {
        return undefined;
      }
    };

    // ===== CHECKOUT =====
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer: customerId,
        line_items: [{ price: selectedPriceId, quantity: 1 }],
        success_url: sameOrigin(successUrl) || `${frontendUrl}/assinatura/sucesso`,
        cancel_url: sameOrigin(cancelUrl) || `${frontendUrl}/assinatura/cancelada`,
        allow_promotion_codes: true,
        metadata: { user_id: user.id, price_id: selectedPriceId },
        // Copia o user_id para a assinatura: os eventos customer.subscription.* passam a trazê-lo.
        subscription_data: { metadata: { user_id: user.id } },
      });
    } catch (e: any) {
      // Captura erro do Stripe (modo test/live trocado, price inválido, etc.)
      return fail("Stripe create checkout failed", {
        message: e?.message,
        type: e?.type,
        code: e?.code,
        priceId: selectedPriceId,
      });
    }

    return ok({ url: session.url });
  } catch (err: any) {
    // Qualquer erro inesperado
    return fail("Unhandled error", { message: err?.message || String(err) });
  }
});
