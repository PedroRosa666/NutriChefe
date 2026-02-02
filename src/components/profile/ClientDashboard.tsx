import { Target, Activity, Heart, Clock, Flame, Leaf, Wheat, Droplet, Salad } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSettingsStore } from '../../store/settings';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useTranslation } from '../../hooks/useTranslation';
import { DashboardMetricCard } from './DashboardMetricCard';

type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';

const goalMeta: Record<MacroKey, { icon: ReactNode; unit: string }> = {
  calories: { icon: <Flame className="h-4 w-4" />, unit: 'kcal' },
  protein: { icon: <Leaf className="h-4 w-4" />, unit: 'g' },
  carbs: { icon: <Wheat className="h-4 w-4" />, unit: 'g' },
  fat: { icon: <Droplet className="h-4 w-4" />, unit: 'g' },
  fiber: { icon: <Salad className="h-4 w-4" />, unit: 'g' },
};

export function ClientDashboard() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes, loading } = useRecipesStore();
  const { goals } = useNutritionGoalsStore();
  const t = useTranslation();

  const isClient = user?.type === 'Client';
  if (!user || !isClient) return null;

  const profile = user.profile || {};

  const favoriteRecipesList = useMemo(
    () => recipes.filter((recipe) => favoriteRecipes.includes(recipe.id)),
    [recipes, favoriteRecipes],
  );

  const stats = useMemo(() => {
    const totalFavorites = favoriteRecipesList.length;

    const caloriesSum = favoriteRecipesList.reduce(
      (acc, recipe) => acc + (recipe.nutritionFacts?.calories ?? 0),
      0,
    );

    const prepTimeSum = favoriteRecipesList.reduce(
      (acc, recipe) => acc + (recipe.prepTime ?? 0),
      0,
    );

    const averageCalories = totalFavorites ? caloriesSum / totalFavorites : 0;
    const averagePrepTime = totalFavorites ? prepTimeSum / totalFavorites : 0;

    return { totalFavorites, averageCalories, averagePrepTime };
  }, [favoriteRecipesList]);

  const { language } = useSettingsStore();

  const nf = useMemo(
    () =>
      new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
        maximumFractionDigits: 0,
      }),
    [language],
  );

  return (
    <div className="space-y-8">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/perfil?tab=favorites"
          className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Heart className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          {t.profile.favorites}
        </Link>

        <Link
          to="/perfil?tab=nutrition"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
        >
          <Target className="h-4 w-4" />
          {t.profile.editGoals ?? t.common.save}
        </Link>

        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {loading ? t.common.loading : null}
        </span>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <DashboardMetricCard
          icon={<Heart className="h-4 w-4" />}
          label={t.profile.favorites}
          value={stats.totalFavorites}
          helperText={stats.totalFavorites ? t.profile.favoritesHelper ?? undefined : t.profile.noFavorites}
          tone="rose"
        />

        <DashboardMetricCard
          icon={<Activity className="h-4 w-4" />}
          label={t.profile.nutritionGoalsnames.calories}
          value={
            <span>
              {nf.format(stats.averageCalories)} <span className="text-base font-semibold text-slate-500 dark:text-slate-400">kcal</span>
            </span>
          }
          helperText={stats.totalFavorites ? t.profile.avgBasedOnFavorites ?? undefined : t.profile.addFavoritesToSeeStats ?? undefined}
          tone="amber"
        />

        <DashboardMetricCard
          icon={<Clock className="h-4 w-4" />}
          label={t.recipe.prepTime}
          value={
            <span>
              {nf.format(stats.averagePrepTime)} <span className="text-base font-semibold text-slate-500 dark:text-slate-400">min</span>
            </span>
          }
          helperText={stats.totalFavorites ? t.profile.avgPrepTimeHelper ?? undefined : undefined}
          tone="sky"
        />

        <DashboardMetricCard
          icon={<Target className="h-4 w-4" />}
          label={t.profile.healthGoals}
          value={profile.healthGoals?.length || 0}
          helperText={(profile.healthGoals?.length || 0) ? undefined : (t.profile.addHealthGoals ?? undefined)}
          tone="emerald"
        />
      </div>

      {/* Metas diárias */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.profile.dailyGoals}
          </h3>

          <Link
            to="/perfil?tab=nutrition"
            className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            {t.profile.editGoals ?? t.common.edit}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {(Object.entries(goals) as Array<[MacroKey, number]>).map(([key, value]) => (
            <div
              key={key}
              className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                    {goalMeta[key]?.icon}
                  </span>
                  <span className="truncate">
                    {t.profile.nutritionGoalsnames?.[key] ?? key}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
                {nf.format(value)}{' '}
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {goalMeta[key]?.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Favoritos recentes */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.profile.recentFavorites}
          </h3>

          {favoriteRecipesList.length > 0 && (
            <Link
              to="/perfil?tab=favorites"
              className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              {t.profile.viewAll ?? t.common.search}
            </Link>
          )}
        </div>

        {favoriteRecipesList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t.profile.noFavorites}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.profile.addFavoritesToSeeStats ?? 'Favorite some recipes to see your stats here.'}
            </p>
            <div className="mt-4 flex justify-center">
              <Link
                to="/"
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                {t.profile.discoverRecipes ?? 'Discover recipes'}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favoriteRecipesList
              .slice()
              .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
              .slice(0, 3)
              .map((recipe) => (
                <Link
                  key={recipe.id}
                  to={`/receita/${recipe.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200/40 dark:ring-slate-800/50"
                  />
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-700 dark:text-slate-50 dark:group-hover:text-emerald-300">
                      {recipe.title}
                    </h4>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                      {recipe.category}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>★ {recipe.rating.toFixed(1)}</span>
                      <span>•</span>
                      <span>{recipe.prepTime}min</span>
                      {recipe.nutritionFacts?.calories != null && (
                        <>
                          <span>•</span>
                          <span>{nf.format(recipe.nutritionFacts.calories)} kcal</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
