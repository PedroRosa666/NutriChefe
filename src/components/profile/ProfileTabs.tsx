import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Apple, HeartPulse, Heart, Settings, BookOpen, Briefcase } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { RecipeCard } from '../RecipeCard';
import { NutritionGoalsForm } from '../nutrition/NutritionGoalsForm';
import { ActiveGoalsSelector } from '../nutrition/ActiveGoalsSelector';
import { NutritionDiary } from '../nutrition/NutritionDiary';
import { EditProfessionalProfile } from './EditProfessionalProfile';
import { ClientDashboard } from './ClientDashboard';
import { NutritionistDashboard } from './NutritionistDashboard';
import { HealthProfileForm } from './HealthProfileForm';
import { AccountSettings } from './AccountSettings';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

type TabKey = 'overview' | 'nutrition' | 'health' | 'recipes' | 'professional' | 'favorites' | 'account';

const CLIENT_TABS: TabKey[] = ['overview', 'nutrition', 'health', 'favorites', 'account'];
const NUTRITIONIST_TABS: TabKey[] = ['overview', 'recipes', 'professional', 'favorites', 'account'];

const ICONS: Record<TabKey, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  nutrition: Apple,
  health: HeartPulse,
  recipes: BookOpen,
  professional: Briefcase,
  favorites: Heart,
  account: Settings,
};

export function ProfileTabs() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const t = useTranslation();
  // A aba fica na URL (?tab=...): links do painel e o botão voltar funcionam.
  const [searchParams, setSearchParams] = useSearchParams();

  const isNutritionist = user?.type === 'Nutritionist';
  const tabs = isNutritionist ? NUTRITIONIST_TABS : CLIENT_TABS;
  const requested = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = requested && tabs.includes(requested) ? requested : 'overview';

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
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="h-4 w-4" />
                {t.profile.tabs[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {activeTab === 'overview' && (isNutritionist ? <NutritionistDashboard /> : <ClientDashboard />)}

        {activeTab === 'nutrition' && (
          <div className="space-y-6">
            <ActiveGoalsSelector />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <NutritionGoalsForm />
              </div>
              <NutritionDiary />
            </div>
          </div>
        )}

        {activeTab === 'health' && <HealthProfileForm />}

        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {userRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
            {userRecipes.length === 0 && empty(t.profile.noRecipesYet)}
          </div>
        )}

        {activeTab === 'professional' && (
          <div className="max-w-4xl rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">{t.nutritionists.editProfile.title}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t.nutritionists.editProfile.subtitle}</p>
            </div>
            <EditProfessionalProfile />
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
      </div>
    </div>
  );
}
