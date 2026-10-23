import React, { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Apple, HeartPulse, Heart, Settings, BookOpen, Briefcase, Users, CalendarRange, ShoppingCart, Carrot, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { RecipeCard } from '../RecipeCard';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useHealthProfileStore } from '../../store/health-profile';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { SMOOTH, tabContent } from '../../lib/motion';

// Cada aba é carregada só quando aberta: o celular baixa menos código ao entrar no perfil.
const lazyNamed = <M,>(load: () => Promise<M>, name: keyof M) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));

const NutritionGoalsForm = lazyNamed(() => import('../nutrition/NutritionGoalsForm'), 'NutritionGoalsForm');
const ActiveGoalsSelector = lazyNamed(() => import('../nutrition/ActiveGoalsSelector'), 'ActiveGoalsSelector');
const NutritionDiary = lazyNamed(() => import('../nutrition/NutritionDiary'), 'NutritionDiary');
const EditProfessionalProfile = lazyNamed(() => import('./EditProfessionalProfile'), 'EditProfessionalProfile');
const AIAssistantSettings = lazyNamed(() => import('./AIAssistantSettings'), 'AIAssistantSettings');
const ClientDashboard = lazyNamed(() => import('./ClientDashboard'), 'ClientDashboard');
const NutritionistDashboard = lazyNamed(() => import('./NutritionistDashboard'), 'NutritionistDashboard');
const HealthProfileForm = lazyNamed(() => import('./HealthProfileForm'), 'HealthProfileForm');
const AccountSettings = lazyNamed(() => import('./AccountSettings'), 'AccountSettings');
const PatientsPanel = lazyNamed(() => import('../care/PatientsPanel'), 'PatientsPanel');
const ShoppingListPanel = lazyNamed(() => import('../plans/ShoppingListPanel'), 'ShoppingListPanel');
const MyFoodsPanel = lazyNamed(() => import('../foods/MyFoodsPanel'), 'MyFoodsPanel');
const MessagesPanel = lazyNamed(() => import('../care/MessagesPanel'), 'MessagesPanel');
const PlansSection = lazy(() => import('../plans/PlansSection').then((m) => ({ default: m.PlansSection })));

type TabKey =
  | 'overview'
  | 'plan'
  | 'nutrition'
  | 'shopping'
  | 'messages'
  | 'health'
  | 'patients'
  | 'recipes'
  | 'foods'
  | 'professional'
  | 'favorites'
  | 'account';

const CLIENT_TABS: TabKey[] = ['overview', 'plan', 'nutrition', 'shopping', 'messages', 'health', 'favorites', 'account'];
const NUTRITIONIST_TABS: TabKey[] = ['overview', 'patients', 'recipes', 'foods', 'professional', 'favorites', 'account'];

const ICONS: Record<TabKey, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  plan: CalendarRange,
  nutrition: Apple,
  shopping: ShoppingCart,
  messages: MessageCircle,
  patients: Users,
  health: HeartPulse,
  recipes: BookOpen,
  foods: Carrot,
  professional: Briefcase,
  favorites: Heart,
  account: Settings,
};

export function ProfileTabs() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const dailyCalories = useNutritionGoalsStore((s) => s.goals.calories);
  const health = useHealthProfileStore((s) => s.profile);
  const t = useTranslation();
  // A aba fica na URL (?tab=...): links do painel e o botão voltar funcionam.
  const [searchParams, setSearchParams] = useSearchParams();

  const isNutritionist = user?.type === 'Nutritionist';
  const tabs = isNutritionist ? NUTRITIONIST_TABS : CLIENT_TABS;
  const requested = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = requested && tabs.includes(requested) ? requested : 'overview';

  // Faixa de abas que rola para o lado: sombras nas bordas mostram que há mais abas.
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges]);
  // A aba aberta (por link ou pelo botão voltar) sempre fica à vista.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeTab]);

  const selectTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next);
  };

  const userRecipes = recipes.filter((recipe) => recipe.authorId === user?.id);
  const userFavorites = recipes.filter((recipe) => favoriteRecipes.includes(recipe.id));

  const empty = (text: string) => (
    <p className="col-span-full rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {text}
    </p>
  );

  return (
    <div className="space-y-6">
      <div className="relative -mx-4 sm:mx-0">
      <div ref={stripRef} onScroll={updateEdges} className="overflow-x-auto px-4 sm:px-0">
        <div role="tablist" className="inline-flex min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((tab) => {
            const Icon = ICONS[tab];
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(tab)}
                className={cn(
                  'relative inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                  active
                    ? 'text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                {/* A pílula verde desliza da aba anterior para a nova. */}
                {active && (
                  <motion.span
                    layoutId="profile-tab-pill"
                    className="absolute inset-0 rounded-lg bg-emerald-600 shadow-sm"
                    transition={SMOOTH}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{t.profile.tabs[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>
      {edges.left && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[rgb(var(--nc-page))] to-transparent" />
      )}
      {edges.right && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-[rgb(var(--nc-page))] to-transparent pr-1">
          <span className="sr-only">{t.profileUi.moreTabs}</span>
        </div>
      )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeTab}
        role="tabpanel"
        variants={tabContent}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          }
        >
        {activeTab === 'overview' && (isNutritionist ? <NutritionistDashboard /> : <ClientDashboard />)}

        {activeTab === 'nutrition' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <NutritionDiary />
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <NutritionGoalsForm />
                </div>
                <ActiveGoalsSelector />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && <HealthProfileForm />}

        {activeTab === 'plan' && user && (
          <PlansSection
            clientId={user.id}
            mode="client"
            dailyCalories={dailyCalories}
            allergies={health.allergies}
            preferences={health.dietary_preferences}
          />
        )}

        {activeTab === 'shopping' && <ShoppingListPanel />}

        {activeTab === 'messages' && <MessagesPanel />}

        {activeTab === 'patients' && <PatientsPanel />}

        {activeTab === 'foods' && <MyFoodsPanel />}

        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {userRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
            {userRecipes.length === 0 && empty(t.profile.noRecipesYet)}
          </div>
        )}

        {activeTab === 'professional' && (
          <div className="max-w-4xl rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">{t.nutritionists.editProfile.title}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t.nutritionists.editProfile.subtitle}</p>
            </div>
            <EditProfessionalProfile />
          </div>
        )}
        {activeTab === 'professional' && (
          <div className="mt-6">
            <AIAssistantSettings />
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {userFavorites.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
            {userFavorites.length === 0 && empty(t.profile.noFavorites)}
          </div>
        )}

        {activeTab === 'account' && <AccountSettings />}
        </Suspense>
      </motion.div>
      </AnimatePresence>
    </div>
  );
}
