import React from 'react';
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
      className={[
        'relative inline-flex items-center justify-center rounded-full px-4 py-2',
        'text-xs sm:text-sm font-semibold transition-all',
        'border',
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700'
          : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700 hover:border-slate-200 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-slate-100',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function ProfileTabs() {
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

  const [activeTab, setActiveTab] = React.useState<'recipes' | 'favorites' | 'nutrition'>(
    user?.type === 'Nutritionist' ? 'recipes' : 'favorites',
  );

  // Se o user carregar depois, garante uma aba válida pro tipo dele
  React.useEffect(() => {
    if (!user) return;
    setActiveTab((prev) => {
      if (user.type === 'Nutritionist') {
        return prev === 'favorites' || prev === 'nutrition' ? prev : 'recipes';
      }
      // Client
      return prev === 'favorites' || prev === 'nutrition' ? prev : 'favorites';
    });
  }, [user]);

  return (
    <div className="mt-8">
      {/* Container dos tabs */}
      <div className="mb-6 rounded-xl border border-slate-100 bg-white/80 p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-wrap gap-2">
          {user?.type === 'Nutritionist' && (
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
          <Tab
            active={activeTab === 'nutrition'}
            onClick={() => setActiveTab('nutrition')}
          >
            {Nutrition_goal}
          </Tab>
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="mt-4">
        {/* Minhas Receitas (apenas nutricionista) */}
        {activeTab === 'recipes' && user?.type === 'Nutritionist' && (
          <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            {userRecipes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.profile.noRecipesYet}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {userRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Favoritos */}
        {activeTab === 'favorites' && (
          <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            {userFavorites.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.profile.noFavorites}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {userFavorites.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metas nutricionais */}
        {activeTab === 'nutrition' && (
          <div className="mx-auto max-w-lg rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
            <NutritionGoalsForm />
          </div>
        )}
      </div>
    </div>
  );
}
