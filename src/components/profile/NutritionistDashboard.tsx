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
    userRecipes.length > 0
      ? userRecipes.reduce((acc, recipe) => acc + (recipe.rating || 0), 0) /
        userRecipes.length
      : 0;

  const hasRecipes = userRecipes.length > 0;

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Seção de informações pessoais + resumo */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        {/* Infos pessoais */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
            {t.profile.personalInfo}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/80">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-1">
                {t.profile.name}
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 break-words">
                {user.name}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/80">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-1">
                {t.profile.email}
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50 break-words">
                {user.email}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/80">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-1">
                {t.profile.accountType}
              </p>
              <p className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                {t.profile.nutricionist}
              </p>
            </div>
          </div>
        </div>

        {/* Resumo de performance */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/15 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200 mb-1.5">
            {t.profile.overview || 'Resumo'}
          </p>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50 mb-3">
            {hasRecipes
              ? t.profile.overviewDescription ||
                'Veja como suas receitas estão performando na plataforma.'
              : t.profile.noRecipesYet ||
                'Você ainda não publicou receitas. Comece a compartilhar seu trabalho!'}
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/80">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-1">
                {t.profile.publishedRecipes}
              </p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {userRecipes.length}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/80">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-1">
                {t.profile.averageRating}
              </p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {hasRecipes && averageRating > 0 ? averageRating.toFixed(1) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/80">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-1">
                {t.profile.totalReviews}
              </p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {totalReviews}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/80">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-1">
                {t.profile.experience}
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {profile.experience || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.profile.publishedRecipes}
            </h3>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {userRecipes.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.profile.totalReviews}
            </h3>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {totalReviews}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.profile.averageRating}
            </h3>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {hasRecipes && averageRating > 0 ? averageRating.toFixed(1) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-100">
              {t.profile.experience}
            </h3>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {profile.experience || 'N/A'}
          </p>
        </div>
      </div>

      {/* Minhas receitas */}
      <div className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t.profile.myRecipes}
        </h3>

        {!hasRecipes ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.profile.noRecipesShort ||
              'Você ainda não publicou nenhuma receita.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {userRecipes
              .slice(-3)
              .reverse()
              .map((recipe) => (
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
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
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
        )}
      </div>
    </div>
  );
}
