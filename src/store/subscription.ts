import { create } from 'zustand';
import * as subscriptionService from '../services/subscription';
import { useToastStore } from './toast';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';

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
  createSubscription: (subscription: Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
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
          const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar planos';
          set({ error: errorMessage, loading: false });
          useToastStore.getState().showToast('Erro ao carregar planos de assinatura', 'error');
        }
      },

      fetchUserSubscription: async (userId: string) => {
        try {
          const subscription = await subscriptionService.getUserSubscription(userId);
          set({ userSubscription: subscription, subscriptionLoaded: true });
        } catch (error) {
          console.error('Error fetching user subscription:', error);
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

      createSubscription: async (subscription) => {
        set({ loading: true, error: null });
        try {
          const newSubscription = await subscriptionService.createSubscription(subscription);
          set({ userSubscription: newSubscription, loading: false });
          useToastStore.getState().showToast('Assinatura ativada com sucesso!', 'success');
        } catch (error) {
          console.error('Error creating subscription:', error);
          const errorMessage = error instanceof Error ? error.message : 'Erro ao criar assinatura';
          set({ error: errorMessage, loading: false });
          useToastStore.getState().showToast('Erro ao ativar assinatura', 'error');
          throw error;
        }
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
