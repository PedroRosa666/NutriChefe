export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_period: string;
  features: string[];
  stripe_product_id?: string;  // ADICIONADO
  stripe_price_id?: string;    // ADICIONADO
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  started_at: string;
  expires_at?: string;
  auto_renew: boolean;
  payment_method?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';


export async function startCheckout({ priceId, planId, successUrl, cancelUrl } : { priceId?: string, planId?: string, successUrl?: string, cancelUrl?: string }) {
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session?.access_token) throw sessionErr || new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { priceId, planId, successUrl, cancelUrl },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Falha ao criar sessão de pagamento');
  (window as any).location.href = data.url as string;
}
