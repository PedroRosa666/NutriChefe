import { User, Mail, ChefHat, Heart, TrendingUp, Clock, Crown } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useSubscriptionStore } from '../../store/subscription';
import { useTranslation } from '../../hooks/useTranslation';

export function ProfileCard() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const { goals, activeGoals } = useNutritionGoalsStore();
  const { entries } = useNutritionTrackingStore();
  const { isPremium } = useSubscriptionStore();
  const t = useTranslation();

  if (!user) return null;

  const userRecipes = recipes.filter((r) => r.authorId === user.id);
  const totalFavorites = recipes.filter((r) => favoriteRecipes.includes(r.id)).length;
  const isNutritionist = user.type === 'Nutritionist';
  const isPremiumUser = isPremium();
  const hasGoals = activeGoals.length > 0;
  const trackingDays = new Set(entries.map(e => e.date)).size;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 flex flex-col sm:flex-row sm:items-center gap-6">

      {/* Avatar */}
      <div className="flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shadow-inner">
        <User className="h-10 w-10 text-emerald-700 dark:text-emerald-300" />
      </div>

      {/* Infos */}
      <div className="flex-1 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {user.name}
        </h2>

        <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            {user.email}
          </div>

          <div className="flex items-center gap-2">
            {isPremiumUser && !isNutritionist ? (
              <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            ) : (
              <ChefHat className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            )}
            {isNutritionist
              ? t.profile.nutricionist
              : isPremiumUser
                ? t.profile.clientPremium
                : t.profile.client
            }
          </div>
        </div>

        {/* Stats for Nutritionist */}
        {isNutritionist && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center border border-emerald-100 dark:border-emerald-800/60">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {userRecipes.length}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t.profile.publishedRecipes}
              </span>
            </div>

            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center border border-emerald-100 dark:border-emerald-800/60">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {totalFavorites}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t.profile.favorites}
              </span>
            </div>
          </div>
        )}

        {/* Stats for Client */}
        {!isNutritionist && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center border border-emerald-100 dark:border-emerald-800/60">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1">
                <Heart className="h-4 w-4" />
                {totalFavorites}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t.profile.favorites}
              </span>
            </div>

            {hasGoals && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 text-center border border-blue-100 dark:border-blue-800/60">
                <p className="text-lg font-semibold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {activeGoals.length}
                </p>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t.profile.activeGoalsLabel}
                </span>
              </div>
            )}

            {trackingDays > 0 && (
              <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3 text-center border border-purple-100 dark:border-purple-800/60">
                <p className="text-lg font-semibold text-purple-700 dark:text-purple-300 flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4" />
                  {trackingDays}
                </p>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t.profile.trackedDays}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
