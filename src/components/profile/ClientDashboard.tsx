import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Target, Activity, Heart, Clock, Crown } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useSubscriptionStore } from '../../store/subscription';
import { useTranslation } from '../../hooks/useTranslation';

export function ClientDashboard() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const { goals, activeGoals } = useNutritionGoalsStore();
  const { getTotalsForDate, entries } = useNutritionTrackingStore();
  const { isPremium } = useSubscriptionStore();
  const t = useTranslation();
  const isPremiumUser = isPremium();

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

  const todayDate = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const todayTotals = useMemo(() => getTotalsForDate(todayDate), [getTotalsForDate, todayDate, entries]);

  const goalLabels = t.profile.nutritionGoalsnames;
  return (
    <div className="space-y-8">
      {/* Badge Premium */}
      {isPremiumUser && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/40 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                {t.profile.clientPremium}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t.labels.aiMentoring} • {t.labels.unlimitedAccess}
              </p>
            </div>
          </div>
        </div>
      )}

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
            <span>{t.labels.activeGoals}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {activeGoals.length}
          </p>
        </div>
      </div>

      {/* Metas diárias (com progresso real) */}
      {Object.keys(goals).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.profile.dailyGoals}
            </h3>
            <Link
              to="/perfil?tab=nutrition"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {t.profile.viewDiaryAndGoals ?? 'Ver diário e metas'}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((key) => {
              if (!activeGoals.includes(key)) return null;

              const goal = goals[key] ?? 0;
              const value = todayTotals[key] ?? 0;
              const pct = goal > 0 ? Math.min(1, value / goal) : 0;
              const unit = key === 'calories' ? 'kcal' : 'g';
              const remaining = Math.max(0, goal - value);

              return (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {goalLabels[key]}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {value.toFixed(1)} / {goal.toFixed(1)} {unit} • {t.profile.remaining ?? 'Restante'}: {remaining.toFixed(1)} {unit}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.profile.progressBasedOnDiary ?? 'O progresso é calculado com base no que você registra no diário alimentar.'}
          </p>
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
