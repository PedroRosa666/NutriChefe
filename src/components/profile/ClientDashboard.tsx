import { Target, Activity, Heart, Clock, Utensils } from 'lucide-react';
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
    favoriteRecipes.includes(recipe.id)
  );

  // Estatísticas
  const totalFavorites = favoriteRecipesList.length;
  const averageCalories =
    favoriteRecipesList.reduce(
      (acc, recipe) => acc + recipe.nutritionFacts.calories,
      0
    ) / (totalFavorites || 1);
  const averagePrepTime =
    favoriteRecipesList.reduce((acc, recipe) => acc + recipe.prepTime, 0) /
    (totalFavorites || 1);

  return (
    <div className="space-y-10">
      {/* --- Informações pessoais --- */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
          {t.profile.personalInfo}
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: t.profile.name, value: user.name },
            { label: t.profile.email, value: user.email },
            { label: t.profile.accountType, value: t.profile.client },
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

      {/* --- Cards de estatísticas --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            icon: Heart,
            title: t.profile.favorites,
            value: totalFavorites,
          },
          {
            icon: Activity,
            title: t.profile.nutritionGoalsnames.calories,
            value: `${averageCalories.toFixed(0)} kcal`,
          },
          {
            icon: Clock,
            title: t.recipe.prepTime,
            value: `${averagePrepTime.toFixed(0)} min`,
          },
          {
            icon: Target,
            title: t.profile.healthGoals,
            value: profile.healthGoals?.length || 0,
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

      {/* --- Metas diárias --- */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h3 className="font-semibold mb-4 text-slate-900 dark:text-white">
          {t.profile.dailyGoals}
        </h3>

        {Object.keys(goals).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.profile.noGoalsYet || 'Você ainda não definiu metas diárias.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(goals).map(([key, value]) => {
              const translatedKey =
                (t.profile.nutritionGoalsnames &&
                  // @ts-ignore – flexível para as chaves
                  t.profile.nutritionGoalsnames[key]) || key;

              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800/70"
                >
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {value}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {translatedKey}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Favoritos recentes --- */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t.profile.recentFavorites}
          </h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            <Utensils className="w-3 h-3" />
            {totalFavorites} {t.profile.favorites?.toLowerCase?.() || 'favoritos'}
          </span>
        </div>

        {favoriteRecipesList.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.profile.noFavorites || 'Você ainda não adicionou receitas aos favoritos.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteRecipesList.slice(0, 3).map((recipe) => (
              <div
                key={recipe.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700"
              >
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                />
                <div className="min-w-0">
                  <h4 className="font-medium text-slate-900 dark:text-white truncate">
                    {recipe.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {recipe.category}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      ★ {recipe.rating.toFixed(1)}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{recipe.prepTime}min</span>
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
