import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MotionConfig, motion } from 'framer-motion';
import { pageFade } from '../lib/motion';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Toast } from '../components/common/Toast';
import { MobileNav } from '../components/common/MobileNav';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { AppHeader } from '../components/common/AppHeader';
import { useLiveNotifications } from '../store/notifications';
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
import { usePremiumStore } from '../store/premium';
import { useUnreadMessagesStore } from '../store/unread-messages';
import { DemoBanner } from '../components/admin/DemoBanner';

export function RootLayout() {
  const { message, type, hideToast } = useToastStore();
  const userId = useAuthStore((s) => s.user?.id);
  const isClient = useAuthStore((s) => s.user?.type === 'Client');
  // Uma "seção" por primeiro trecho da URL; /receita/:id faz parte da home (é um modal).
  const { pathname } = useLocation();
  const section = pathname.startsWith('/receita/') ? '/' : `/${pathname.split('/')[1] ?? ''}`;
  useLiveNotifications();

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

    // Outra aba entrou ou saiu (a sessão no localStorage mudou): acompanha aqui também.
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith('sb-') || !e.key.endsWith('-auth-token')) return;
      if (!e.newValue) useAuthStore.getState().clearSession();
      else useAuthStore.getState().initializeAuth();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Toque numa notificação com o app já aberto: o service worker pede para ir à tela.
  const navigate = useNavigate();
  useEffect(() => {
    const onWorkerMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string' && e.data.url.startsWith('/')) navigate(e.data.url);
    };
    navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
  }, [navigate]);

  // Mensagens não lidas (contador da navegação): reconta ao trocar de tela e a cada minuto.
  const { search } = useLocation();
  useEffect(() => {
    if (userId) useUnreadMessagesStore.getState().refresh(userId);
  }, [userId, pathname, search]);
  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(() => useUnreadMessagesStore.getState().refresh(userId), 60_000);
    return () => window.clearInterval(id);
  }, [userId]);

  // Dados que dependem do usuário logado.
  const accountSeen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Os alimentos próprios visíveis dependem da conta: recarrega quando ela muda.
    useFoodsStore.getState().clear();
    // Troca de conta (logout, ou de uma conta direto para outra, como no Laboratório do admin):
    // nada do usuário anterior pode ficar na memória.
    useSubscriptionStore.getState().reset();
    usePremiumStore.getState().reset();
    useRecipesStore.getState().clearUserData();
    useNutritionGoalsStore.getState().reset();
    useNutritionTrackingStore.getState().reset();
    useHealthProfileStore.getState().reset();
    useShoppingListStore.getState().reset();
    useUnreadMessagesStore.getState().reset();
    import('../store/ai').then((m) => m.useAIStore.getState().reset());
    // As receitas exclusivas só vêm para quem tem Premium: a lista muda com a conta. Na
    // primeira vez (abrindo o app) a tela inicial já busca com a conta atual.
    if (accountSeen.current !== undefined && accountSeen.current !== (userId ?? null)) useRecipesStore.getState().refresh();
    accountSeen.current = userId ?? null;
    if (userId) {
      useSubscriptionStore.getState().fetchUserSubscription(userId);
      usePremiumStore.getState().fetch(userId);
      useRecipesStore.getState().fetchFavorites(userId);
      // Metas, diário e saúde só existem para clientes.
      if (isClient) {
        useNutritionGoalsStore.getState().fetchGoals(userId);
        useNutritionTrackingStore.getState().fetchEntries(userId);
        useHealthProfileStore.getState().fetchHealthProfile(userId);
      }
    }
  }, [userId, isClient]);

  return (
    <ErrorBoundary>
      <DemoBanner />
      {/* reducedMotion="user": quem pediu menos movimento no sistema não vê as animações. */}
      <MotionConfig reducedMotion="user">
        {/* A home tem o próprio cabeçalho (com a busca); as outras páginas logadas usam este. */}
        {userId && section !== '/' && section !== '/login' && <AppHeader />}
        {/* No celular, logado, sobra espaço para a barra de navegação inferior. */}
        <motion.div
          key={`${section}:${userId ?? 'anon'}`}
          variants={pageFade}
          initial="initial"
          animate="animate"
          className={userId ? 'pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] md:pb-0' : undefined}
        >
          <Outlet />
        </motion.div>
        <MobileNav />
        <ConfirmDialog />
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
