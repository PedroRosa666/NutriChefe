import { supabase } from '../lib/supabase';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';
import { feedback } from '../lib/i18n/current';

/** Lista planos ativos, ordenados por preço (asc). */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as SubscriptionPlan[];
}

/**
 * Retorna a assinatura que vale agora (com plano populado): a ativa e não vencida, se houver;
 * senão a mais recente. Uma pessoa pode ter mais de uma linha (ex.: assinatura antiga
 * cancelada e uma nova), e a mais recente nem sempre é a que está valendo.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  const rows = (data ?? []) as unknown as UserSubscription[];
  const now = Date.now();
  const current = rows.find(
    (s) => s.status === 'active' && (!s.expires_at || new Date(s.expires_at).getTime() > now)
  );
  return current ?? rows[0] ?? null;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  let session = data.session;
  if (error || !session?.access_token) {
    const refreshed = await supabase.auth.refreshSession().catch(() => null);
    session = refreshed?.data?.session ?? null;
  }
  if (!session?.access_token) {
    throw new Error(feedback().subscription.loginRequired);
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
  if (!data?.url) throw new Error(data?.error || feedback().subscription.portalError);
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

  // Detalhes técnicos (em inglês) vão para o console; a pessoa vê uma frase no idioma dela.
  if (invokeError && !result) {
    console.error('Checkout failed:', invokeError.message);
    throw new Error(feedback().subscription.checkoutNoResponse);
  }
  if (!result) throw new Error(feedback().subscription.checkoutNoResponse);
  if (result.error) {
    console.error('Checkout failed:', result.error);
    // Única recusa que a pessoa resolve sozinha: já tem assinatura ativa (mensagem do servidor já em português).
    throw new Error(/assinatura ativa/.test(String(result.error)) ? String(result.error) : feedback().subscription.checkoutNoResponse);
  }
  if (!result.url) throw new Error(feedback().subscription.checkoutNoUrl);

  redirectTo(result.url as string);
}
