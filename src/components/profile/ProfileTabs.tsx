import React from 'react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { RecipeCard } from '../RecipeCard';
import { NutritionGoalsForm } from '../nutrition/NutritionGoalsForm';
import { NutritionDiary } from '../nutrition/NutritionDiary';
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

export function ProfileTabs() {
  const [activeTab, setActiveTab] =
    React.useState<'recipes' | 'favorites' | 'nutrition'>('favorites');
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

  // Guard invalid tabs per role.
  // - Nutritionist: recipes | favorites
  // - Client: favorites | nutrition
  React.useEffect(() => {
    if (isNutritionist) {
      if (activeTab === 'nutrition') setActiveTab('recipes');
      return;
    }

    if (activeTab === 'recipes') setActiveTab('favorites');
  }, [isNutritionist, activeTab]);

  return (
    <div className="space-y-6">
      {/* Barra de abas */}
      <div className="inline-flex rounded-full border border-slate-100 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
        {isNutritionist && (
          <Tab
            active={activeTab === 'recipes'}
            onClick={() => setActiveTab('recipes')}
          >
            {MyRecipes}
          </Tab>
        )}
        <Tab
          active={activeTab === 'favorites'}
          onClick={() => setActiveTab('favorites')}
        >
          {Favorites}
        </Tab>
        {!isNutritionist && (
          <Tab
            active={activeTab === 'nutrition'}
            onClick={() => setActiveTab('nutrition')}
          >
            {Nutrition_goal}
          </Tab>
        )}
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

        {activeTab === 'nutrition' && !isNutritionist && (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-5">
              <NutritionGoalsForm />
            </div>
            <NutritionDiary />
          </div>
        )}
      </div>
    </div>
  );
}
