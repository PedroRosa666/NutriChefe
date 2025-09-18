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
  if (error && (error as any).code !== 'PGRST116') throw error;
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
  // 1) precisa estar autenticado para vincular o pagamento ao usuário
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr || !session?.access_token) {
    throw sessionErr || new Error('Not authenticated');
  }

  // 2) chama a Edge Function (create-checkout-session) no Supabase
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { priceId, planId, successUrl, cancelUrl },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Falha ao criar sessão de pagamento');

  // 3) redireciona para o Stripe Checkout
  (window as any).location.href = data.url as string;
}
