import { User, Mail, ChefHat, Heart, Star } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';

export function ProfileCard() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const t = useTranslation();

  if (!user) return null;

  const userRecipes = recipes.filter((r) => r.authorId === user.id);
  const totalFavorites = recipes.filter((r) => favoriteRecipes.includes(r.id)).length;

  const isNutritionist = user.type === 'Nutritionist';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 flex flex-col sm:flex-row sm:items-center gap-6">
      
      {/* Avatar */}
      <div className="flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shadow-inner">
        <User className="h-10 w-10 text-emerald-700 dark:text-emerald-300" />
      </div>

      {/* Infos */}
      <div className="flex-1 space-y-2">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {user.name}
        </h2>

        <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            {user.email}
          </div>

          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            {isNutritionist ? t.profile.nutricionist : t.profile.client}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {isNutritionist && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center border border-emerald-100 dark:border-emerald-800/60">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {userRecipes.length}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t.profile.publishedRecipes}
              </span>
            </div>
          )}

          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center border border-emerald-100 dark:border-emerald-800/60">
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              {totalFavorites}
            </p>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {t.profile.favorites}
            </span>
          </div>

          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center border border-emerald-100 dark:border-emerald-800/60">
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {userRecipes.length > 0
                ? (
                    userRecipes.reduce((acc, r) => acc + r.rating, 0) /
                    userRecipes.length
                  ).toFixed(1)
                : '—'}
            </p>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {t.profile.averageRating}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
