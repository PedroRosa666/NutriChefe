import React, { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, NotebookPen, HeartPulse, Heart, Settings, BookOpen, Briefcase, Users, CalendarRange, ShoppingCart, Carrot, MessageCircle, Plus, Library } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { RecipeCard } from '../RecipeCard';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useHealthProfileStore } from '../../store/health-profile';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { SMOOTH, tabContent } from '../../lib/motion';
import { sectionOfTab, tabsFor, type TabKey } from '../../lib/app-sections';
import { useAppRole } from '../../hooks/useAppNav';

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
const NutritionistInbox = lazyNamed(() => import('../care/NutritionistInbox'), 'NutritionistInbox');
const CreateRecipeForm = lazy(() => import('../CreateRecipeForm').then((m) => ({ default: m.CreateRecipeForm })));
const PlansSection = lazy(() => import('../plans/PlansSection').then((m) => ({ default: m.PlansSection })));

const ICONS: Record<TabKey, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  plan: CalendarRange,
  nutrition: NotebookPen,
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

/** Largura máxima do esmaecimento nas bordas da faixa de abas. */
const FADE_PX = 44;

export function ProfileTabs() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const dailyCalories = useNutritionGoalsStore((s) => s.goals.calories);
  const health = useHealthProfileStore((s) => s.profile);
  const t = useTranslation();
  // A aba fica na URL (?tab=...): links do painel e o botão voltar funcionam.
  const [searchParams, setSearchParams] = useSearchParams();

  const isNutritionist = user?.type === 'Nutritionist';
  const role = useAppRole();
  const tabs = tabsFor(role);
  const requested = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = requested && tabs.includes(requested) ? requested : tabs[0];
  // A navegação principal escolhe a seção; aqui ficam só as abas dentro dela.
  const section = sectionOfTab(role, activeTab);
  const activeItem = section.items.find((i) => i.tabs.includes(activeTab)) ?? section.items[0];
  const [creatingRecipe, setCreatingRecipe] = useState(false);
  // Atalho "Nova receita" do painel (?nova=1): abre o formulário e tira o parâmetro da URL.
  const wantsNewRecipe = isNutritionist && searchParams.has('nova');
  useEffect(() => {
    if (!wantsNewRecipe) return;
    setCreatingRecipe(true);
    const next = new URLSearchParams(searchParams);
    next.delete('nova');
    setSearchParams(next, { replace: true });
  }, [wantsNewRecipe, searchParams, setSearchParams]);

  // Faixa de abas que rola para o lado: as bordas esmaecem para mostrar que há mais abas.
  // O esmaecimento cresce junto com o que falta rolar, então aparece e some aos poucos.
  const stripRef = useRef<HTMLDivElement>(null);
  const updateEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const left = Math.min(el.scrollLeft, FADE_PX);
    const right = Math.min(Math.max(el.scrollWidth - el.clientWidth - el.scrollLeft, 0), FADE_PX);
    el.style.setProperty('--fade-l', `${left}px`);
    el.style.setProperty('--fade-r', `${right}px`);
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges, section.key]);
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
      {section.items.length > 1 ? (
        <div className="-mx-4 sm:mx-0">
          <div ref={stripRef} onScroll={updateEdges} className="scroll-fade-x overflow-x-auto px-4 sm:px-0">
            <div role="tablist" className="inline-flex min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
              {section.items.map((item) => {
                const Icon = item.key === 'content' ? Library : ICONS[item.tabs[0]];
                const active = item === activeItem;
                return (
                  <button
                    key={item.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectTab(item.tabs[0])}
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
                    <span className="relative">{item.key === 'content' ? t.profileUi.content : t.profile.tabs[item.tabs[0]]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Seção de uma aba só: um título no lugar da faixa (o Início já tem a saudação).
        // Pacientes já tem o próprio cabeçalho (com o botão de convite).
        activeTab !== 'overview' && activeTab !== 'patients' && (
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.profile.tabs[activeTab]}</h1>
        )
      )}

      {/* Conteúdo do nutricionista: receitas, alimentos e favoritos num seletor só. */}
      {activeItem.tabs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="inline-flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {activeItem.tabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={tab === activeTab}
                onClick={() => selectTab(tab)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === activeTab
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300'
                    : 'text-slate-600 dark:text-slate-300'
                )}
              >
                {t.profile.tabs[tab]}
              </button>
            ))}
          </div>
          {/* Sem receitas, o botão fica só no aviso de lista vazia. */}
          {activeTab === 'recipes' && userRecipes.length > 0 && (
            <button
              type="button"
              onClick={() => setCreatingRecipe(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              {t.profileUi.newRecipe}
            </button>
          )}
        </div>
      )}

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

        {activeTab === 'messages' && (isNutritionist ? <NutritionistInbox /> : <MessagesPanel />)}

        {activeTab === 'patients' && <PatientsPanel />}

        {activeTab === 'foods' && <MyFoodsPanel />}

        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {userRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
            {userRecipes.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.profile.noRecipesYet}</p>
                <button
                  type="button"
                  onClick={() => setCreatingRecipe(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  {t.profileUi.newRecipe}
                </button>
              </div>
            )}
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

      {creatingRecipe && (
        <Suspense fallback={null}>
          <CreateRecipeForm isOpen onClose={() => setCreatingRecipe(false)} />
        </Suspense>
      )}
    </div>
  );
}
