import { Award, Users, BookOpen, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';

export function NutritionistDashboard() {
  const { user } = useAuthStore();
  const { recipes } = useRecipesStore();
  const t = useTranslation();

  if (!user || user.type !== 'Nutritionist') return null;

  const profile = user.profile || {};
  const userRecipes = recipes.filter((recipe) => recipe.authorId === user.id);
  const totalReviews = userRecipes.reduce(
    (acc, recipe) => acc + recipe.reviews.length,
    0,
  );
  const averageRating =
    userRecipes.reduce((acc, recipe) => acc + recipe.rating, 0) /
      (userRecipes.length || 1) || 0;

  return (
    <div className="space-y-8">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <BookOpen className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.profile.publishedRecipes}</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {userRecipes.length}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Users className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.profile.totalReviews}</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalReviews}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.profile.averageRating}</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {averageRating.toFixed(1)}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Award className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>{t.profile.experience}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {profile.experience || 'N/A'}
          </p>
        </div>
      </div>

      {/* Últimas receitas publicadas */}
      {userRecipes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.profile.myRecipes}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userRecipes
              .slice(-3)
              .reverse()
              .map((recipe) => (
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
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>★ {recipe.rating.toFixed(1)}</span>
                      <span>•</span>
                      <span>
                        {recipe.reviews.length} {t.recipe.reviews}
                      </span>
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
