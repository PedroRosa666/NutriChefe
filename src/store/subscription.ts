import { create } from 'zustand';
import * as subscriptionService from '../services/subscription';
import { useToastStore } from './toast';
import { useAuthStore } from './auth';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';
import { feedback } from '../lib/i18n/current';

interface SubscriptionState {
  plans: SubscriptionPlan[];
  userSubscription: UserSubscription | null;
  /** true depois da primeira busca da assinatura do usuário logado. */
  subscriptionLoaded: boolean;
  loading: boolean;
  error: string | null;
  fetchPlans: () => Promise<void>;
  fetchUserSubscription: (userId: string) => Promise<void>;
  hasFeatureAccess: (feature: string) => boolean;
  isPremium: () => boolean;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
    (set, get) => ({
      plans: [],
      userSubscription: null,
      subscriptionLoaded: false,
      loading: false,
      error: null,

      fetchPlans: async () => {
        set({ loading: true, error: null });
        try {
          const plans = await subscriptionService.getSubscriptionPlans();
          set({ plans, loading: false });
        } catch (error) {
          console.error('Error fetching plans:', error);
          const errorMessage = error instanceof Error ? error.message : feedback().subscription.loadPlansError;
          set({ error: errorMessage, loading: false });
          useToastStore.getState().showToast(feedback().subscription.loadPlansToast, 'error');
        }
      },

      fetchUserSubscription: async (userId: string) => {
        try {
          const subscription = await subscriptionService.getUserSubscription(userId);
          // Resposta de outra conta (troca de usuário no meio do caminho): descarta.
          if (useAuthStore.getState().user?.id !== userId) return;
          set({ userSubscription: subscription, subscriptionLoaded: true });
        } catch (error) {
          console.error('Error fetching user subscription:', error);
          if (useAuthStore.getState().user?.id !== userId) return;
          set({ userSubscription: null, subscriptionLoaded: true });
        }
      },

      hasFeatureAccess: (feature: string) => {
        const { userSubscription } = get();
        if (!userSubscription?.plan || userSubscription.status !== 'active') {
          return false;
        }
        if (userSubscription.expires_at && new Date(userSubscription.expires_at).getTime() < Date.now()) {
          return false;
        }
        return Array.isArray(userSubscription.plan.features) && userSubscription.plan.features.includes(feature);
      },

      isPremium: () => {
        return get().hasFeatureAccess('ai_mentoring');
      },

      reset: () => set({
        plans: [],
        userSubscription: null,
        subscriptionLoaded: false,
        loading: false,
        error: null
      })
    })
);

// A assinatura vinha do localStorage (dava para editar no navegador). Agora vem sempre do banco.
try {
  localStorage.removeItem('subscription-storage');
} catch {
  /* storage indisponível */
}
