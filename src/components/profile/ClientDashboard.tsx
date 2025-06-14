import { Target, AlertTriangle, Utensils, Activity, Heart, Clock } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useTranslation } from '../../hooks/useTranslation';

export function ClientDashboard() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const { goals } = useNutritionGoalsStore();
  const t = useTranslation();

  if (!user || user.type !== 'Client') return null;

  const profile = user.profile || {};
  const favoriteRecipesList = recipes.filter(recipe => favoriteRecipes.includes(recipe.id));

  // Calculate statistics
  const totalFavorites = favoriteRecipesList.length;
  const averageCalories = favoriteRecipesList.reduce((acc, recipe) =>
    acc + recipe.nutritionFacts.calories, 0) / (totalFavorites || 1);
  const averagePrepTime = favoriteRecipesList.reduce((acc, recipe) =>
    acc + recipe.prepTime, 0) / (totalFavorites || 1);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{t.profile.personalInfo}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t.profile.name}</label>
            <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t.profile.email}</label>
            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t.profile.accountType}</label>
            <p className="font-medium capitalize text-gray-900 dark:text-white">{t.profile.client}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.profile.favorites}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalFavorites}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.profile.nutritionGoalsnames.calories}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{averageCalories.toFixed(0)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.recipe.prepTime}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{averagePrepTime.toFixed(0)}min</p>
        </div>


        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.profile.healthGoals}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{profile.healthGoals?.length || 0}</p>
        </div>
      </div>


      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{t.profile.dailyGoals}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(goals).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">{key}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{t.profile.recentFavorites}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteRecipesList.slice(0, 3).map(recipe => (
            <div key={recipe.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{recipe.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{recipe.category}</p>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>★ {recipe.rating.toFixed(1)}</span>
                  <span>•</span>
                  <span>{recipe.prepTime}min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}