import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Toast } from '../components/common/Toast';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useRecipesStore } from '../store/recipes';
import { useHealthProfileStore } from '../store/health-profile';
import { useNutritionGoalsStore } from '../store/nutrition-goals';
import { useNutritionTrackingStore } from '../store/nutrition-tracking';
import { useSubscriptionStore } from '../store/subscription';
import { useToastStore } from '../store/toast';

export function RootLayout() {
  const { message, type, hideToast } = useToastStore();
  const userId = useAuthStore((s) => s.user?.id);
  const isClient = useAuthStore((s) => s.user?.type === 'Client');

  // Sessão: carrega uma vez e acompanha login/logout/expiração em qualquer rota.
  useEffect(() => {
    useAuthStore.getState().initializeAuth();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().clearSession();
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Fora do callback: chamadas ao supabase dentro dele podem travar o client.
        setTimeout(() => useAuthStore.getState().initializeAuth(), 0);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // Dados que dependem do usuário logado.
  useEffect(() => {
    if (userId) {
      useSubscriptionStore.getState().fetchUserSubscription(userId);
      useRecipesStore.getState().fetchFavorites(userId);
      // Metas, diário e saúde só existem para clientes.
      if (isClient) {
        useNutritionGoalsStore.getState().fetchGoals(userId);
        useNutritionTrackingStore.getState().fetchEntries(userId);
        useHealthProfileStore.getState().fetchHealthProfile(userId);
      }
    } else {
      // Logout: nada do usuário anterior pode ficar na memória.
      useSubscriptionStore.getState().reset();
      useRecipesStore.getState().clearUserData();
      useNutritionGoalsStore.getState().reset();
      useNutritionTrackingStore.getState().reset();
      useHealthProfileStore.getState().reset();
      // Import dinâmico: o store da IA (e o serviço dele) fica fora do bundle inicial.
      import('../store/ai').then((m) => m.useAIStore.getState().reset());
    }
  }, [userId, isClient]);

  return (
    <ErrorBoundary>
      <Outlet />
      {message && (
        <Toast
          message={message}
          type={type}
          onClose={hideToast}
        />
      )}
    </ErrorBoundary>
  );
}
