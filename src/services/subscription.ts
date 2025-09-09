import { supabase } from '../lib/supabase';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows returned
    throw error;
  }
  
  return data;
}

async function hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription || !subscription.plan) return false;
    
    return subscription.plan.features.includes(feature);
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
}

export async function createSubscription(subscription: Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'>): Promise<UserSubscription> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .insert([subscription])
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

async function updateSubscription(subscriptionId: string, updates: Partial<UserSubscription>): Promise<UserSubscription> {
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
  return data;
}