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
  const totalReviews = userRecipes.reduce((acc, recipe) => acc + recipe.reviews.length, 0);
  const averageRating =
    userRecipes.reduce((acc, recipe) => acc + recipe.rating, 0) / userRecipes.length || 0;

  return (
    <div className="space-y-10">
      {/* --- Personal Info --- */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
          {t.profile.personalInfo}
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {[ 
            { label: t.profile.name, value: user.name },
            { label: t.profile.email, value: user.email },
            { label: t.profile.accountType, value: t.profile.nutricionist }
          ].map((field, index) => (
            <div
              key={index}
              className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {field.label}
              </label>
              <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">
                {field.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* --- Stats Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            icon: BookOpen,
            title: t.profile.publishedRecipes,
            value: userRecipes.length,
          },
          {
            icon: Users,
            title: t.profile.totalReviews,
            value: totalReviews,
          },
          {
            icon: TrendingUp,
            title: t.profile.averageRating,
            value: averageRating.toFixed(1),
          },
          {
            icon: Award,
            title: t.profile.experience,
            value: profile.experience || 'N/A',
          },
        ].map((stat, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm flex flex-col gap-3 dark:border-slate-800 dark:bg-slate-900/80"
          >
            <div className="flex items-center gap-3">
              <stat.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {stat.title}
              </h3>
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* --- Últimas Receitas --- */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h3 className="font-semibold mb-4 text-slate-900 dark:text-white">
          {t.profile.myRecipes}
        </h3>

        {userRecipes.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {t.profile.noRecipesYet || 'Nenhuma receita publicada até o momento.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userRecipes.slice(-3).map((recipe) => (
              <div
                key={recipe.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
              >
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                />

                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">
                    {recipe.title}
                  </h4>

                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1">
                    <span className="flex items-center gap-1 font-medium text-yellow-500">
                      ★ {recipe.rating.toFixed(1)}
                    </span>

                    <span className="text-slate-400">•</span>

                    <span>
                      {recipe.reviews.length} {t.recipe.reviews}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
