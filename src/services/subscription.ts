import { supabase } from '../lib/supabase';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';

/** Lista planos ativos, ordenados por preço (asc). */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Retorna a assinatura mais recente do usuário (com plano populado). */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // PGRST116 = no rows; tratamos como null
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

/** Cria uma assinatura (uso interno/admin; para cobrança use o Stripe Checkout). */
export async function createSubscription(
  subscription: Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'>
): Promise<UserSubscription> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .insert(subscription)
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .single();

  if (error) throw error;
  return data!;
}

/** Atualiza uma assinatura existente por id. */
export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<UserSubscription>
): Promise<UserSubscription> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .update(updates)
    .eq('id', subscriptionId)
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .single();

  if (error) throw error;
  return data!;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  let session = data.session;
  if (error || !session?.access_token) {
    const refreshed = await supabase.auth.refreshSession().catch(() => null);
    session = refreshed?.data?.session ?? null;
  }
  if (!session?.access_token) {
    throw new Error('Você precisa estar logado. Faça login e tente novamente.');
  }
  return session.access_token;
}

function redirectTo(url: string) {
  // Sair de iframe se necessário (StackBlitz/WebContainer)
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {/* ignore */}
  window.location.assign(url);
}

/**
 * Abre o portal do Stripe, onde o assinante cancela, troca o cartão e vê faturas.
 */
export async function openBillingPortal() {
  const accessToken = await getAccessToken();
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: { returnUrl: `${window.location.origin}/perfil?tab=account` },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error && !data) throw new Error(error.message);
  if (!data?.url) throw new Error(data?.error || 'Não foi possível abrir o portal de assinatura.');
  redirectTo(data.url as string);
}

/**
 * Inicia o Stripe Checkout (assinatura recorrente).
 * Aceita `priceId` diretamente OU `planId` (busca o price do plano no backend).
 */
export async function startCheckout({
  priceId,
  planId,
  successUrl,
  cancelUrl,
}: {
  priceId?: string;
  planId?: string;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const accessToken = await getAccessToken();

  // A Edge Function sempre responde 200 com ok:true/false
  const { data: result, error: invokeError } = await supabase.functions.invoke('create-checkout-session', {
    body: { priceId, planId, successUrl, cancelUrl },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (invokeError && !result) throw new Error(`Checkout failed: ${invokeError.message}`);
  if (!result) throw new Error('Checkout failed: sem resposta do servidor');
  if (result.error) {
    const hint = result.debug?.priceId
      ? ` (priceId: ${result.debug.priceId}${result.debug?.message ? ` • ${result.debug.message}` : ''})`
      : '';
    throw new Error(`Checkout failed: ${result.error}${hint}`);
  }
  if (!result.url) throw new Error('Falha ao criar sessão de pagamento (sem URL)');

  redirectTo(result.url as string);
}
