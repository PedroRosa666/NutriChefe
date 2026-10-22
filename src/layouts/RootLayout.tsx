import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MotionConfig, motion } from 'framer-motion';
import { pageFade } from '../lib/motion';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Toast } from '../components/common/Toast';
import { MobileNav } from '../components/common/MobileNav';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useRecipesStore } from '../store/recipes';
import { useHealthProfileStore } from '../store/health-profile';
import { useNutritionGoalsStore } from '../store/nutrition-goals';
import { useNutritionTrackingStore } from '../store/nutrition-tracking';
import { useSubscriptionStore } from '../store/subscription';
import { useShoppingListStore } from '../store/shopping-list';
import { useFoodsStore } from '../store/foods';
import { useToastStore } from '../store/toast';

export function RootLayout() {
  const { message, type, hideToast } = useToastStore();
  const userId = useAuthStore((s) => s.user?.id);
  const isClient = useAuthStore((s) => s.user?.type === 'Client');
  // Uma "seção" por primeiro trecho da URL; /receita/:id faz parte da home (é um modal).
  const { pathname } = useLocation();
  const section = pathname.startsWith('/receita/') ? '/' : `/${pathname.split('/')[1] ?? ''}`;

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
    // Os alimentos próprios visíveis dependem da conta: recarrega quando ela muda.
    useFoodsStore.getState().clear();
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
      useShoppingListStore.getState().reset();
      // Import dinâmico: o store da IA (e o serviço dele) fica fora do bundle inicial.
      import('../store/ai').then((m) => m.useAIStore.getState().reset());
    }
  }, [userId, isClient]);

  return (
    <ErrorBoundary>
      {/* reducedMotion="user": quem pediu menos movimento no sistema não vê as animações. */}
      <MotionConfig reducedMotion="user">
        {/* No celular, logado, sobra espaço para a barra de navegação inferior. */}
        <motion.div
          key={section}
          variants={pageFade}
          initial="initial"
          animate="animate"
          className={userId ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0' : undefined}
        >
          <Outlet />
        </motion.div>
        <MobileNav />
      </MotionConfig>
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
