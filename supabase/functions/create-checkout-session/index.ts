/** Supabase Edge Function: create-checkout-session */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // === Env checks (erro legível se faltar algo) ===
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // precisa ser service role
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "";

    if (!supabaseUrl) return json({ error: "Missing env SUPABASE_URL" }, 500);
    if (!supabaseKey) return json({ error: "Missing env SUPABASE_SERVICE_ROLE_KEY" }, 500);
    if (!stripeSecret) return json({ error: "Missing env STRIPE_SECRET_KEY" }, 500);
    if (!frontendUrl) return json({ error: "Missing env FRONTEND_URL" }, 500);

    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as any });

    // === Auth ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header (Bearer <access_token>)" }, 401);
    }
    const accessToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken);
    if (userErr || !user) return json({ error: "Not authenticated (invalid token)" }, 401);

    // === Payload ===
    const body = await req.json().catch(() => ({}));
    const { priceId, planId, successUrl, cancelUrl } = body as any;

    let selectedPriceId = priceId as string | undefined;

    // Se não veio priceId mas veio planId, tenta buscar do banco
    if (!selectedPriceId && planId) {
      const { data: plan, error: planErr } = await supabase
        .from("subscription_plans")
        .select("stripe_price_id")
        .eq("id", planId)
        .single();

      if (planErr) return json({ error: `Plan lookup failed: ${planErr.message}` }, 400);
      if (!plan?.stripe_price_id) return json({ error: "Plan has no stripe_price_id" }, 400);

      selectedPriceId = plan.stripe_price_id;
    }

    if (!selectedPriceId) {
      return json({ error: "Missing priceId or planId" }, 400);
    }

    // === Garantir/associar customer ===
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

    // === Criar sessão de checkout ===
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      success_url: successUrl || `${frontendUrl}/assinatura/sucesso`,
      cancel_url: cancelUrl || `${frontendUrl}/assinatura/cancelada`,
      allow_promotion_codes: true,
      metadata: { user_id: user.id, price_id: selectedPriceId },
    });

    return json({ url: session.url }, 200);
  } catch (err: any) {
    // Erro legível (inclui mensagem do Stripe se for o caso)
    console.error("create-checkout-session error:", err);
    const message = err?.message || String(err);
    return json({ error: message }, 500);
  }
});
