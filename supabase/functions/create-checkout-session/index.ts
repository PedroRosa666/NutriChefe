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

const fail = (msg: string, debug?: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: false, error: msg, ...(debug ? { debug } : {}) }), {
    status: 200, // <-- SEMPRE 200 para o cliente receber a msg
    headers: cors,
  });

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

    let selectedPriceId = priceId as string | undefined;

    // Se veio planId mas não veio priceId, buscar do banco
    if (!selectedPriceId && planId) {
      const { data: plan, error: planErr } = await supabase
        .from("subscription_plans")
        .select("stripe_price_id")
        .eq("id", planId)
        .single();

      if (planErr) return fail("Plan lookup failed", { planErr: planErr.message, planId });
      if (!plan?.stripe_price_id) return fail("Plan has no stripe_price_id", { planId });
      selectedPriceId = plan.stripe_price_id;
    }

    if (!selectedPriceId) {
      return fail("Missing priceId or planId");
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

    // ===== CHECKOUT =====
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer: customerId,
        line_items: [{ price: selectedPriceId, quantity: 1 }],
        success_url: successUrl || `${frontendUrl}/assinatura/sucesso`,
        cancel_url: cancelUrl || `${frontendUrl}/assinatura/cancelada`,
        allow_promotion_codes: true,
        metadata: { user_id: user.id, price_id: selectedPriceId },
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
