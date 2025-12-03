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
    <section className="mt-8 space-y-6">
      <div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
          {t.profile.healthOverview || 'Resumo da sua jornada de saúde'}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          Acompanhe seus favoritos, metas nutricionais e como suas escolhas se
          conectam com seus objetivos.
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
              <Heart className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t.profile.favorites}
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-500">
                {totalFavorites}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
              <Activity className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t.profile.nutritionGoalsnames.calories}
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-500">
                {averageCalories.toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
              <Clock className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t.recipe.prepTime}
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-500">
                {averagePrepTime.toFixed(0)}min
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
              <Target className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t.profile.healthGoals}
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-500">
                {profile.healthGoals?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metas diárias + favoritos recentes lado a lado */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
          <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
            {t.profile.dailyGoals}
          </h3>
          {Object.keys(goals).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t.profile.noGoals || 'Você ainda não definiu metas diárias.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Object.entries(goals).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg bg-gray-50 px-3 py-3 text-center text-sm dark:bg-gray-800/70"
                >
                  <div className="text-lg font-semibold text-emerald-500">
                    {value}
                  </div>
                  <div className="mt-1 text-xs capitalize text-gray-600 dark:text-gray-400">
                    {key}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
          <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
            {t.profile.recentFavorites}
          </h3>
          {favoriteRecipesList.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t.profile.noFavorites ||
                'Você ainda não adicionou receitas aos favoritos.'}
            </p>
          ) : (
            <div className="space-y-3">
              {favoriteRecipesList.slice(0, 3).map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-800/70"
                >
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {recipe.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                      {recipe.category}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>★ {recipe.rating.toFixed(1)}</span>
                      <span className="h-1 w-1 rounded-full bg-gray-400" />
                      <span>{recipe.prepTime}min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
