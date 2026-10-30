import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
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
import { useSettingsStore } from '../store/settings';
import { usePremiumStore } from '../store/premium';
import { useUnreadMessagesStore } from '../store/unread-messages';
import { DemoBanner } from '../components/admin/DemoBanner';
import { UpdateBanner } from '../components/common/UpdateBanner';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';

export function RootLayout() {
  const { message, type, hideToast } = useToastStore();
  const userId = useAuthStore((s) => s.user?.id);
  const isClient = useAuthStore((s) => s.user?.type === 'Client');
  // Uma "seção" por primeiro trecho da URL; /receita/:id faz parte da home (é um modal).
  const { pathname } = useLocation();
  const section = pathname.startsWith('/receita/') ? '/' : `/${pathname.split('/')[1] ?? ''}`;
  useLiveNotifications();
  const t = useTranslation();

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

  // Tela nova começa do topo. As abas do perfil (/perfil?tab=...) são telas diferentes na mesma
  // rota, então a aba conta como troca; filtros e a ficha aberta (outros parâmetros) não. A receita
  // aberta por cima da home (/receita/:id) é da mesma seção e não mexe na rolagem.
  // Voltar/avançar do navegador (POP) mantém onde a pessoa estava.
  const navigationType = useNavigationType();
  const screen = `${section}?${new URLSearchParams(search).get('tab') ?? ''}`;
  const lastScreen = useRef(screen);
  useEffect(() => {
    if (lastScreen.current === screen) return;
    lastScreen.current = screen;
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [screen, navigationType]);
  useEffect(() => {
    if (userId) useUnreadMessagesStore.getState().refresh(userId);
  }, [userId, pathname, search]);
  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(() => useUnreadMessagesStore.getState().refresh(userId), 60_000);
    return () => window.clearInterval(id);
  }, [userId]);

  // Idioma da página para o leitor de tela pronunciar certo (WCAG 3.1.1).
  const language = useSettingsStore((st) => st.language);
  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  }, [language]);

  // Cada tela tem um título próprio na aba do navegador (o h1 da página) e, ao trocar de seção,
  // o foco vai para esse h1: quem usa leitor de tela ouve onde chegou (WCAG 2.4.2 e 2.4.3).
  const firstRoute = useRef(true);
  const lastSection = useRef(section);
  useEffect(() => {
    const sectionChanged = lastSection.current !== section && !firstRoute.current;
    lastSection.current = section;
    firstRoute.current = false;
    // As páginas carregam sob demanda: espera o conteúdo montar.
    const timers = [300, 1200].map((ms) =>
      window.setTimeout(() => {
        const h1 = document.querySelector<HTMLElement>('#conteudo h1');
        const text = h1?.textContent?.trim();
        // Com uma janela aberta (a receita por cima da home), o título é dela (RecipeDetails).
        if (!document.querySelector('[role="dialog"]')) {
          document.title = text && text !== 'NutriChef' ? `${text} · NutriChef` : 'NutriChef';
        }
        if (sectionChanged && ms === 300 && h1 && !document.querySelector('[role="dialog"]')) {
          h1.setAttribute('tabindex', '-1');
          h1.focus({ preventScroll: true });
        }
      }, ms)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [section, pathname, search]);

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
      {/* reducedMotion="user": quem pediu menos movimento no sistema não vê as animações. */}
      <MotionConfig reducedMotion="user">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        {t.common.skipToContent}
      </a>
      <UpdateBanner />
      <DemoBanner />
        {/* A home tem o próprio cabeçalho (com a busca); as outras páginas logadas usam este. */}
        {userId && section !== '/' && section !== '/login' && <AppHeader />}
        {/* No celular, logado, sobra espaço para a barra de navegação inferior. */}
        <motion.main
          id="conteudo"
          tabIndex={-1}
          key={`${section}:${userId ?? 'anon'}`}
          variants={pageFade}
          initial="initial"
          animate="animate"
          className={cn('outline-none', userId && 'pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] md:pb-0')}
        >
          <Outlet />
        </motion.main>
        <MobileNav />
        <ConfirmDialog />
        {message && (
          <Toast
            message={message}
            type={type}
            onClose={hideToast}
          />
        )}
      </MotionConfig>
    </ErrorBoundary>
  );
}
