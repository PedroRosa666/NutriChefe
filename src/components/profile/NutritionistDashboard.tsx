import { Award, Users, BookOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';
import { DashboardMetricCard } from './DashboardMetricCard';

export function NutritionistDashboard() {
  const { user } = useAuthStore();
  const { recipes } = useRecipesStore();
  const t = useTranslation();

  if (!user || user.type !== 'Nutritionist') return null;

  const profile = user.profile || {};

  const userRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.authorId === user.id),
    [recipes, user.id],
  );

  const totalReviews = useMemo(
    () => userRecipes.reduce((acc, recipe) => acc + recipe.reviews.length, 0),
    [userRecipes],
  );

  const averageRating = useMemo(() => {
    const sum = userRecipes.reduce((acc, recipe) => acc + recipe.rating, 0);
    return userRecipes.length ? sum / userRecipes.length : 0;
  }, [userRecipes]);

  return (
    <div className="space-y-8">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <DashboardMetricCard
          icon={<BookOpen className="h-4 w-4" />}
          label={t.profile.publishedRecipes}
          value={userRecipes.length}
          helperText={userRecipes.length ? undefined : t.profile.noRecipesYet}
          tone="emerald"
        />

        <DashboardMetricCard
          icon={<Users className="h-4 w-4" />}
          label={t.profile.totalReviews}
          value={totalReviews}
          tone="sky"
        />

        <DashboardMetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label={t.profile.averageRating}
          value={averageRating.toFixed(1)}
          helperText={userRecipes.length ? undefined : t.profile.publishToGetReviews ?? undefined}
          tone="amber"
        />

        <DashboardMetricCard
          icon={<Award className="h-4 w-4" />}
          label={t.profile.experience}
          value={profile.experience || 'N/A'}
          tone="slate"
        />
      </div>

      {/* Últimas receitas publicadas */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.profile.myRecipes}
          </h3>

          {userRecipes.length > 0 && (
            <Link
              to="/perfil?tab=recipes"
              className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              {t.profile.viewAll ?? t.common.search}
            </Link>
          )}
        </div>

        {userRecipes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t.profile.noRecipesYet}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.profile.publishFirstRecipe ?? 'Publish your first recipe to start receiving reviews.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userRecipes
              .slice(-3)
              .reverse()
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
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200/40 dark:ring-slate-800/50"
                  />
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-700 dark:text-slate-50 dark:group-hover:text-emerald-300">
                      {recipe.title}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>★ {recipe.rating.toFixed(1)}</span>
                      <span>•</span>
                      <span>
                        {recipe.reviews.length} {t.recipe.reviews}
                      </span>
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
