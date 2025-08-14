import React from 'react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { RecipeCard } from '../RecipeCard';
import { NutritionGoalsForm } from '../nutrition/NutritionGoalsForm';
import { GoalsManager } from '../goals/GoalsManager';
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
      className={`px-4 py-2 font-medium rounded-lg transition-colors ${active
          ? 'bg-green-100 text-green-700'
          : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
      {children}
    </button>
  );
}

export function ProfileTabs() {
  const [activeTab, setActiveTab] = React.useState<'recipes' | 'favorites' | 'nutrition' | 'goals'>('recipes');
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();

  const userRecipes = recipes.filter(recipe => recipe.authorId === user?.id);
  const userFavorites = recipes.filter(recipe => favoriteRecipes.includes(recipe.id));

  const t = useTranslation();

  const MyRecipes = t.buttons.My_recipes;
  const Favorites = t.buttons.Favorites;
  const Nutrition_goal = t.buttons.Nutrition_goal;

  return (
    <div className="mt-8">
      <div className="flex gap-2 mb-6">
        {user?.type === 'Nutritionist' && (
          <>
          <Tab
            active={activeTab === 'recipes'}
            onClick={() => setActiveTab('recipes')}
          >
            {MyRecipes}
          </Tab>
          <Tab
            active={activeTab === 'goals'}
            onClick={() => setActiveTab('goals')}
          >
            Metas Pessoais
          </Tab>
          </>
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

      <div className="mt-6">
        {activeTab === 'recipes' && user?.type === 'Nutritionist' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={() => { }} />
            ))}
            {userRecipes.length === 0 && (
              <p className="text-gray-500 col-span-full text-center py-8">
                {t.profile.noRecipesYet}
              </p>
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userFavorites.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={() => { }} />
            ))}
            {userFavorites.length === 0 && (
              <p className="text-gray-500 col-span-full text-center py-8">
                {t.profile.noFavorites}
              </p>
            )}
          </div>
        )}

        {activeTab === 'nutrition' && (
          <div className="max-w-md mx-auto">
            <NutritionGoalsForm />
          </div>
        )}

        {activeTab === 'goals' && (
          <GoalsManager />
        )}
      </div>
    </div>
  );
}