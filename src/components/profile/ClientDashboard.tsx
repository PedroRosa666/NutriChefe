import { Target, Activity, Heart, Clock } from 'lucide-react';
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
  const favoriteRecipesList = recipes.filter((recipe) =>
    favoriteRecipes.includes(recipe.id),
  );

  const totalFavorites = favoriteRecipesList.length;
  const averageCalories =
    favoriteRecipesList.reduce(
      (acc, recipe) => acc + recipe.nutritionFacts.calories,
      0,
    ) / (totalFavorites || 1);
  const averagePrepTime =
    favoriteRecipesList.reduce((acc, recipe) => acc + recipe.prepTime, 0) /
    (totalFavorites || 1);

  return (
    <div className="space-y-8">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Heart className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.profile.favorites}</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalFavorites}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Activity className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.profile.nutritionGoalsnames.calories}</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {averageCalories.toFixed(0)}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Clock className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.recipe.prepTime}</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {averagePrepTime.toFixed(0)}min
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Target className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.profile.healthGoals}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {profile.healthGoals?.length || 0}
          </p>
        </div>
      </div>

      {/* Metas diárias */}
      {Object.keys(goals).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.profile.dailyGoals}
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Object.entries(goals).map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-2xl">
                  {value}
                </div>
                <div className="text-xs capitalize text-slate-500 dark:text-slate-400 sm:text-sm">
                  {key}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favoritos recentes */}
      {favoriteRecipesList.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.profile.recentFavorites}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favoriteRecipesList.slice(0, 3).map((recipe) => (
              <div
                key={recipe.id}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-50">
                    {recipe.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                    {recipe.category}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>★ {recipe.rating.toFixed(1)}</span>
                    <span>•</span>
                    <span>{recipe.prepTime}min</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
