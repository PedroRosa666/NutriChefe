/** Supabase Edge Function: stripe-webhook */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

// No Deno a verificação da assinatura precisa da Web Crypto (versão assíncrona).
// A síncrona (constructEvent) falha aqui e recusava eventos válidos.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-06-20" as any,
    httpClient: Stripe.createFetchHttpClient(),
  });

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig!, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    let subscriptionId: string | null = null;
    let fallbackUserId: string | null = null;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
        fallbackUserId = session.metadata?.user_id ?? null;
        if (fallbackUserId && session.customer) {
          const { error } = await supabase.from("profiles").update({ stripe_customer_id: session.customer }).eq("id", fallbackUserId);
          if (error) throw error;
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        subscriptionId = (event.data.object as any).id;
        break;
      default:
        break;
    }

    // Em vez de confiar no conteúdo do evento (que pode chegar atrasado ou fora de ordem),
    // lê o estado atual da assinatura no Stripe. Repetir o mesmo evento dá o mesmo resultado.
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(supabase, sub, fallbackUserId);
    }
  } catch (e) {
    // 500 faz o Stripe tentar de novo mais tarde.
    console.error("Error handling event", event.id, event.type, e);
    return new Response("Webhook error", { status: 500 });
  }

  return new Response("ok", { headers: corsHeaders });
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function lookupUserIdByCustomer(supabase: any, customerId: string | null) {
  if (!customerId) return null;
  const { data, error } = await supabase.from("profiles").select("id").eq("stripe_customer_id", customerId).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

type AppStatus = "active" | "cancelled" | "expired" | "pending";

// Converte o status do Stripe para os valores aceitos pela tabela user_subscriptions.
function mapStripeStatus(status: string): AppStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    default: // past_due, unpaid, incomplete, paused
      return "pending";
  }
}

function periodEndIso(sub: any): string | undefined {
  // Em versões novas da API o período fica no item da assinatura.
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return typeof end === "number" ? new Date(end * 1000).toISOString() : undefined;
}

// Grava o estado de UMA assinatura do Stripe na linha dela (chave: stripe_subscription_id).
// Antes a linha era "a mais recente do usuário", e um evento de uma assinatura antiga
// podia sobrescrever a nova.
async function syncSubscription(supabase: any, sub: any, fallbackUserId: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const userId = sub.metadata?.user_id || fallbackUserId || (await lookupUserIdByCustomer(supabase, customerId));
  if (!userId) {
    console.error("Stripe subscription without app user", sub.id);
    return;
  }

  const status = mapStripeStatus(sub.status);
  const priceId: string | undefined = sub.items?.data?.[0]?.price?.id;
  let planId: string | null = null;
  if (priceId) {
    const { data: plan, error } = await supabase.from("subscription_plans").select("id").eq("stripe_price_id", priceId).maybeSingle();
    if (error) throw error;
    planId = plan?.id ?? null;
  }
  if (!planId && status === "active") {
    // Preço que não é de nenhum plano do app: não libera nada.
    console.error("Ignoring activation with unknown Stripe price", priceId, "subscription", sub.id);
    return;
  }

  const payload: any = {
    status,
    updated_at: new Date().toISOString(),
    // Assinatura cancelada não renova, mesmo que o último flag diga o contrário.
    auto_renew: status === "active" && sub.cancel_at_period_end !== true,
  };
  if (planId) payload.plan_id = planId;
  const expiresAt = periodEndIso(sub);
  if (expiresAt) payload.expires_at = expiresAt;

  const { data: existing, error: findError } = await supabase
    .from("user_subscriptions")
    .select("id, user_id")
    .eq("stripe_subscription_id", sub.id)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    if (existing.user_id !== userId) {
      console.error("Stripe subscription belongs to another user", sub.id);
      return;
    }
    const { error } = await supabase.from("user_subscriptions").update(payload).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  if (!planId) {
    // plan_id é obrigatório: sem plano mapeado ao preço não há como criar a linha.
    console.error("No subscription_plans row for Stripe price", priceId, "subscription", sub.id);
    return;
  }
  const { error } = await supabase
    .from("user_subscriptions")
    .insert({ user_id: userId, stripe_subscription_id: sub.id, ...payload });
  if (error?.code === "23505") {
    // Outro evento da mesma assinatura criou a linha ao mesmo tempo: atualiza a dele.
    const { error: retryError } = await supabase.from("user_subscriptions").update(payload).eq("stripe_subscription_id", sub.id);
    if (retryError) throw retryError;
  } else if (error) {
    throw error;
  }
}
