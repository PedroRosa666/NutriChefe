import {
  Target,
  AlertTriangle,
  Utensils,
  Activity,
  Heart,
  Clock,
} from 'lucide-react';
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
  const hasFavorites = totalFavorites > 0;

  const averageCalories =
    favoriteRecipesList.reduce(
      (acc, recipe) => acc + (recipe.nutritionFacts?.calories || 0),
      0,
    ) / (totalFavorites || 1);

  const averagePrepTime =
    favoriteRecipesList.reduce(
      (acc, recipe) => acc + (recipe.prepTime || 0),
      0,
    ) / (totalFavorites || 1);

  const nutritionNames = t.profile?.nutritionGoalsnames || {};

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Seção info pessoal + visão geral */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        {/* Infos pessoais */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-50 sm:text-lg">
            {t.profile.personalInfo}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/80">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t.profile.name}
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 break-words">
                {user.name}
              </p>
            </div>

            <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/80">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t.profile.email}
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50 break-words">
                {user.email}
              </p>
            </div>

            <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/80">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t.profile.accountType}
              </p>
              <p className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                {t.profile.client}
              </p>
            </div>
          </div>
        </div>

        {/* Resumo rápido */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/15 sm:p-5">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
            {t.profile.overview || 'Resumo'}
          </p>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50 sm:text-base">
            {hasFavorites
              ? t.profile.overviewClient ||
                'Veja um resumo das suas receitas favoritas e metas diárias.'
              : t.profile.overviewClientEmpty ||
                'Você ainda não favoritou receitas. Comece adicionando algumas para ver estatísticas aqui.'}
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/80">
              <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t.profile.favorites}
              </p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {totalFavorites}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/80">
              <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t.profile.nutritionGoalsnames?.calories || 'Calorias médias'}
              </p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {hasFavorites ? `${averageCalories.toFixed(0)} kcal` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/80">
              <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t.recipe.prepTime}
              </p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {hasFavorites ? `${averagePrepTime.toFixed(0)} min` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/80">
              <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t.profile.healthGoals}
              </p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {profile.healthGoals?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/30">
              <Heart className="h-4 w-4 text-rose-500 dark:text-rose-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.profile.favorites}
            </h3>
          </div>
          <p className="text-2xl font-bold text-rose-500 dark:text-rose-300">
            {totalFavorites}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <Utensils className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.profile.nutritionGoalsnames?.calories || 'Calorias médias'}
            </h3>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {hasFavorites ? `${averageCalories.toFixed(0)} kcal` : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-900/30">
              <Clock className="h-4 w-4 text-sky-600 dark:text-sky-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.recipe.prepTime}
            </h3>
          </div>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-300">
            {hasFavorites ? `${averagePrepTime.toFixed(0)} min` : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30">
              <Target className="h-4 w-4 text-amber-600 dark:text-amber-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.profile.healthGoals}
            </h3>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">
            {profile.healthGoals?.length || 0}
          </p>
        </div>
      </div>

      {/* Metas diárias */}
      <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t.profile.dailyGoals}
          </h3>
          {Object.keys(goals || {}).length === 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              {t.profile.noGoalsSet || 'Nenhuma meta definida ainda.'}
            </span>
          )}
        </div>

        {Object.keys(goals || {}).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.profile.noGoalsDescription ||
              'Defina metas nutricionais no seu perfil para acompanhar melhor o seu progresso.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Object.entries(goals).map(([key, value]) => {
              const label =
                nutritionNames[key as keyof typeof nutritionNames] || key;

              const isCalories = key.toLowerCase().includes('cal');
              const suffix = isCalories ? 'kcal' : 'g';

              return (
                <div
                  key={key}
                  className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900/70"
                >
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                    {value}
                    <span className="ml-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {suffix}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Favoritos recentes */}
      <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t.profile.recentFavorites}
        </h3>

        {!hasFavorites ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.profile.noFavorites ||
              'Você ainda não favoritou nenhuma receita. Explore receitas e marque as que você gostar.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {favoriteRecipesList.slice(0, 3).map((recipe) => (
              <div
                key={recipe.id}
                className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/70"
              >
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src =
                      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop';
                  }}
                />
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                    {recipe.title}
                  </h4>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {recipe.category}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>★ {recipe.rating.toFixed(1)}</span>
                    <span>•</span>
                    <span>{recipe.prepTime} min</span>
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
