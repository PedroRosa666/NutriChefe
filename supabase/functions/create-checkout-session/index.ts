/** Supabase Edge Function: create-checkout-session
 * Creates a Stripe Checkout Session for a given price/plan.
 * Expects JSON body: { priceId?: string, planId?: string, successUrl?: string, cancelUrl?: string }
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
    const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "";

    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as any });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return resp({ error: "Missing Authorization header" }, 401);

    const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !user) return resp({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const { priceId, planId, successUrl, cancelUrl } = body as any;

    let selectedPriceId = priceId as string | undefined;
    if (!selectedPriceId && planId) {
      const { data: plan, error: planErr } = await supabase.from("subscription_plans")
        .select("stripe_price_id").eq("id", planId).single();
      if (planErr || !plan?.stripe_price_id) return resp({ error: "Plan not found or missing stripe_price_id" }, 400);
      selectedPriceId = plan.stripe_price_id;
    }
    if (!selectedPriceId) return resp({ error: "Missing priceId or planId" }, 400);

    // Ensure customer
    const { data: profile } = await supabase.from("profiles")
      .select("id, email, stripe_customer_id").eq("id", user.id).single();

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      success_url: successUrl || `${frontendUrl}/assinatura/sucesso`,
      cancel_url: cancelUrl || `${frontendUrl}/assinatura/cancelada`,
      allow_promotion_codes: true,
      metadata: { user_id: user.id },
    });

    return resp({ url: session.url }, 200);
  } catch (err) {
    console.error(err);
    return resp({ error: String(err) }, 500);
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
