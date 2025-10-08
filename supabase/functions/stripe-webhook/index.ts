/** Supabase Edge Function: stripe-webhook */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as any });

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const priceId = session.metadata?.price_id || session.display_items?.[0]?.price?.id || session.line_items?.data?.[0]?.price?.id;
        const userId = session.metadata?.user_id;
        if (userId && subscriptionId) {
          await upsertActiveSubscription(supabase, userId, subscriptionId, priceId);
        }
        if (userId && customerId) {
          await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as any;
        const userId = sub.metadata?.user_id || (await lookupUserIdByCustomer(supabase, sub.customer));
        await upsertActiveSubscription(supabase, userId, sub.id, sub.items?.data?.[0]?.price?.id);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const userId = sub.metadata?.user_id || (await lookupUserIdByCustomer(supabase, sub.customer));
        if (userId) {
          await supabase.from("user_subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("stripe_subscription_id", sub.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Error handling event", e);
    return new Response("Webhook error", { status: 500 });
  }

  return new Response("ok", { headers: corsHeaders });
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function lookupUserIdByCustomer(supabase: any, customerId: string) {
  if (!customerId) return null;
  const { data } = await supabase.from("profiles").select("id").eq("stripe_customer_id", customerId).single();
  return data?.id ?? null;
}

async function upsertActiveSubscription(supabase: any, userId: string | null, stripeSubId: string, priceId?: string) {
  if (!userId) return;
  // Find plan by price id
  let planId: string | null = null;
  if (priceId) {
    const { data: plan } = await supabase.from("subscription_plans").select("id").eq("stripe_price_id", priceId).maybeSingle();
    planId = plan?.id ?? null;
  }
  const payload: any = {
    status: "active",
    updated_at: new Date().toISOString(),
    stripe_subscription_id: stripeSubId,
  };
  if (planId) payload.plan_id = planId;

  // upsert by user
  const { data: existing } = await supabase.from("user_subscriptions").select("id").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) {
    await supabase.from("user_subscriptions").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("user_subscriptions").insert({ user_id: userId, ...payload });
  }
}
