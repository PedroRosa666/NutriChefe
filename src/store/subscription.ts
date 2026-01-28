import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as subscriptionService from '../services/subscription';
import { useToastStore } from './toast';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';

interface SubscriptionState {
  plans: SubscriptionPlan[];
  userSubscription: UserSubscription | null;
  loading: boolean;
  error: string | null;
  fetchPlans: () => Promise<void>;
  fetchUserSubscription: (userId: string) => Promise<void>;
  hasFeatureAccess: (feature: string) => boolean;
  isPremium: () => boolean;
  createSubscription: (subscription: Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      plans: [],
      userSubscription: null,
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
          set({ userSubscription: subscription });
        } catch (error) {
          console.error('Error fetching user subscription:', error);
          set({ userSubscription: null });
        }
      },

      hasFeatureAccess: (feature: string) => {
        const { userSubscription } = get();
        if (!userSubscription || !userSubscription.plan) {
          return false;
        }
        return userSubscription.plan.features.includes(feature);
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
        loading: false,
        error: null
      })
    }),
    {
      name: 'subscription-storage',
      partialize: (state) => ({ 
        userSubscription: state.userSubscription 
      })
    }
  )
);