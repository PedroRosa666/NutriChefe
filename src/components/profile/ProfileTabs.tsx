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
        'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm md:text-base font-medium transition-all',
        'border',
        active
          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-emerald-500',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function ProfileTabs() {
  const [activeTab, setActiveTab] = React.useState<'recipes' | 'favorites' | 'nutrition'>('recipes');
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const t = useTranslation();

  const userRecipes = recipes.filter((recipe) => recipe.authorId === user?.id);
  const userFavorites = recipes.filter((recipe) => favoriteRecipes.includes(recipe.id));

  const MyRecipes = t.buttons.My_recipes;
  const Favorites = t.buttons.Favorites;
  const Nutrition_goal = t.buttons.Nutrition_goal;

  return (
    <div className="mt-10">
      {/* Header dos tabs */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white">
            {t.profile.myActivity || 'Minha atividade'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.profile.myActivitySubtitle ||
              'Veja suas receitas, favoritos e personalize suas metas nutricionais.'}
          </p>
        </div>

        <div className="inline-flex flex-wrap gap-2 rounded-full bg-slate-50 p-1.5 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
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

      {/* Conteúdo dos tabs */}
      <div className="mt-4">
        {/* Minhas receitas (apenas nutricionista) */}
        {activeTab === 'recipes' && user?.type === 'Nutritionist' && (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            {userRecipes.length === 0 ? (
              <p className="py-10 text-center text-sm md:text-base text-slate-500 dark:text-slate-400">
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
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            {userFavorites.length === 0 ? (
              <p className="py-10 text-center text-sm md:text-base text-slate-500 dark:text-slate-400">
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
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              {t.profile.nutritionGoalsTitle || 'Metas nutricionais diárias'}
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {t.profile.nutritionGoalsSubtitle ||
                'Ajuste suas metas para acompanhar melhor sua alimentação ao longo do dia.'}
            </p>
            <NutritionGoalsForm />
          </div>
        )}
      </div>
    </div>
  );
}
