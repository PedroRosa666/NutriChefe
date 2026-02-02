import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { RecipeCard } from '../RecipeCard';
import { NutritionGoalsForm } from '../nutrition/NutritionGoalsForm';
import { useTranslation } from '../../hooks/useTranslation';

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Tab({ active, onClick, children }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

type ProfileTabKey = 'recipes' | 'favorites' | 'nutrition';

function isValidTab(tab: string | null): tab is ProfileTabKey {
  return tab === 'recipes' || tab === 'favorites' || tab === 'nutrition';
}

export function ProfileTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState<ProfileTabKey>(
    isValidTab(initialTab) ? initialTab : 'favorites',
  );

  React.useEffect(() => {
    const tab = searchParams.get('tab');
    if (isValidTab(tab) && tab !== activeTab) setActiveTab(tab);
  }, [searchParams, activeTab]);

  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const t = useTranslation();

  const userRecipes = recipes.filter((recipe) => recipe.authorId === user?.id);
  const userFavorites = recipes.filter((recipe) =>
    favoriteRecipes.includes(recipe.id),
  );

  const MyRecipes = t.buttons.My_recipes;
  const Favorites = t.buttons.Favorites;
  const Nutrition_goal = t.buttons.Nutrition_goal;

  const isNutritionist = user?.type === 'Nutritionist';

  const handleTab = (tab: ProfileTabKey) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Barra de abas */}
      <div className="inline-flex rounded-full border border-slate-100 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
        {isNutritionist && (
          <Tab active={activeTab === 'recipes'} onClick={() => handleTab('recipes')}>
            {MyRecipes}
          </Tab>
        )}
        <Tab active={activeTab === 'favorites'} onClick={() => handleTab('favorites')}>
          {Favorites}
        </Tab>
        <Tab active={activeTab === 'nutrition'} onClick={() => handleTab('nutrition')}>
          {Nutrition_goal}
        </Tab>
      </div>

      {/* Conteúdo das abas */}
      <div className="mt-2">
        {activeTab === 'recipes' && isNutritionist && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {userRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
            {userRecipes.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.profile.noRecipesYet}
              </p>
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {userFavorites.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
            {userFavorites.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.profile.noFavorites}
              </p>
            )}
          </div>
        )}

        {activeTab === 'nutrition' && (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-5">
            <NutritionGoalsForm />
          </div>
        )}
      </div>
    </div>
  );
}
