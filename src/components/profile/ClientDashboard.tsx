import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Target, Activity, Heart, Clock, TrendingUp, Calendar, Flame, Award, ChevronRight, Plus, BarChart3, Utensils } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useTranslation } from '../../hooks/useTranslation';
import { DashboardMetricCard } from './DashboardMetricCard';

export function ClientDashboard() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const { goals, activeGoals } = useNutritionGoalsStore();
  const { getTotalsForDate, entries, getEntriesForDate } = useNutritionTrackingStore();
  const t = useTranslation();

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

  const weeklyStats = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    });

    const weeklyData = last7Days.map(date => ({
      date,
      totals: getTotalsForDate(date),
      entries: getEntriesForDate(date).length
    }));

    const daysWithEntries = weeklyData.filter(d => d.entries > 0).length;
    const avgCalories = weeklyData.reduce((acc, d) => acc + d.totals.calories, 0) / 7;
    const totalEntries = weeklyData.reduce((acc, d) => acc + d.entries, 0);

    const streak = (() => {
      let count = 0;
      for (const day of weeklyData) {
        if (day.entries > 0) count++;
        else break;
      }
      return count;
    })();

    return {
      daysWithEntries,
      avgCalories,
      totalEntries,
      streak,
      weeklyData
    };
  }, [getTotalsForDate, getEntriesForDate, entries]);

  const mostLoggedRecipes = useMemo(() => {
    const recipeCount = new Map<number, { count: number; title: string }>();
    entries.forEach(entry => {
      const current = recipeCount.get(entry.recipeId);
      if (current) {
        current.count++;
      } else {
        recipeCount.set(entry.recipeId, { count: 1, title: entry.recipeTitle });
      }
    });

    return Array.from(recipeCount.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [entries]);

  const goalProgress = useMemo(() => {
    if (Object.keys(goals).length === 0) return null;

    let onTrack = 0;
    let exceeded = 0;
    let below = 0;

    activeGoals.forEach(key => {
      const goal = goals[key];
      const value = todayTotals[key];
      const pct = goal > 0 ? value / goal : 0;

      if (pct >= 0.8 && pct <= 1.2) onTrack++;
      else if (pct > 1.2) exceeded++;
      else below++;
    });

    return { onTrack, exceeded, below, total: activeGoals.length };
  }, [goals, activeGoals, todayTotals]);

  const goalLabels = t.profile.nutritionGoalsnames;
  const todayEntries = getEntriesForDate(todayDate);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 dark:from-emerald-950/30 dark:to-teal-950/30">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Olá, {profile.name || user.email?.split('@')[0] || 'Cliente'}!
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {weeklyStats.streak > 0
            ? `Você está em uma sequência de ${weeklyStats.streak} ${weeklyStats.streak === 1 ? 'dia' : 'dias'} registrando suas refeições!`
            : 'Comece registrando suas refeições hoje para acompanhar seu progresso.'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          icon={<Flame className="h-5 w-5" />}
          label="Hoje"
          value={`${todayTotals.calories.toFixed(0)}`}
          helperText={`${goals.calories ? `de ${goals.calories.toFixed(0)} kcal` : 'kcal consumidas'}`}
          tone="emerald"
        />

        <DashboardMetricCard
          icon={<Calendar className="h-5 w-5" />}
          label="Sequência"
          value={`${weeklyStats.streak} ${weeklyStats.streak === 1 ? 'dia' : 'dias'}`}
          helperText="Registros consecutivos"
          tone="sky"
        />

        <DashboardMetricCard
          icon={<Utensils className="h-5 w-5" />}
          label="Esta semana"
          value={weeklyStats.totalEntries}
          helperText="Refeições registradas"
          tone="amber"
        />

        <DashboardMetricCard
          icon={<Target className="h-5 w-5" />}
          label="Metas ativas"
          value={activeGoals.length}
          helperText={goalProgress ? `${goalProgress.onTrack} no alvo hoje` : 'Configure suas metas'}
          tone="rose"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/perfil?tab=nutrition"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Registrar Refeição
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adicione ao diário
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
          </Link>

          <Link
            to="/"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <Heart className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Ver Receitas
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Explorar catálogo
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
          </Link>

          <Link
            to="/perfil?tab=nutrition"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
              <BarChart3 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Editar Metas
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure objetivos
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
          </Link>
        </div>
      </div>

      {/* Today's Progress */}
      {Object.keys(goals).length > 0 && activeGoals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Progresso de Hoje
            </h3>
            <Link
              to="/perfil?tab=nutrition"
              className="flex items-center gap-1 text-sm font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Ver detalhes
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((key) => {
              if (!activeGoals.includes(key)) return null;

              const goal = goals[key] ?? 0;
              const value = todayTotals[key] ?? 0;
              const pct = goal > 0 ? value / goal : 0;
              const unit = key === 'calories' ? 'kcal' : 'g';
              const remaining = Math.max(0, goal - value);

              let statusColor = 'emerald';
              let statusText = 'No alvo';
              if (pct < 0.8) {
                statusColor = 'amber';
                statusText = 'Abaixo';
              } else if (pct > 1.2) {
                statusColor = 'rose';
                statusText = 'Acima';
              }

              const colorClasses = {
                emerald: 'bg-emerald-500',
                amber: 'bg-amber-500',
                rose: 'bg-rose-500',
              };

              const badgeClasses = {
                emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
              };

              return (
                <div
                  key={key}
                  className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {goalLabels[key]}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses[statusColor as keyof typeof badgeClasses]}`}>
                          {statusText}
                        </span>
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {value.toFixed(1)}
                        <span className="ml-1 text-sm font-normal text-slate-500">
                          / {goal.toFixed(1)} {unit}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Restante: {remaining.toFixed(1)} {unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${colorClasses[statusColor as keyof typeof colorClasses]}`}
                      style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Overview */}
      {weeklyStats.totalEntries > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Últimos 7 Dias
          </h3>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Dias registrados
                </p>
                <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {weeklyStats.daysWithEntries}/7
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Média de calorias
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {weeklyStats.avgCalories.toFixed(0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total de refeições
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {weeklyStats.totalEntries}
                </p>
              </div>
            </div>

            <div className="flex items-end justify-between gap-2 border-t border-slate-100 pt-6 dark:border-slate-800">
              {weeklyStats.weeklyData.reverse().map((day, idx) => {
                const maxCalories = Math.max(...weeklyStats.weeklyData.map(d => d.totals.calories), 1);
                const heightPct = (day.totals.calories / maxCalories) * 100;
                const hasEntries = day.entries > 0;

                const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(day.date).getDay()];

                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative w-full">
                      <div className="flex h-32 items-end justify-center">
                        <div
                          className={`w-full rounded-t-lg transition-all ${
                            hasEntries
                              ? 'bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                          style={{ height: `${heightPct}%` }}
                          title={`${day.totals.calories.toFixed(0)} kcal`}
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {dayName}
                      </p>
                      {hasEntries && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-500">
                          {day.totals.calories.toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Most Logged Recipes */}
      {mostLoggedRecipes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Suas Receitas Mais Consumidas
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {mostLoggedRecipes.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    #{idx + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Registrada {item.count} {item.count === 1 ? 'vez' : 'vezes'}
                  </p>
                </div>
                <Award className="h-5 w-5 text-amber-500" />
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Insights & Recommendations */}
      {(todayEntries.length > 0 || weeklyStats.totalEntries > 0) && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Insights Personalizados
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {weeklyStats.streak >= 3 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/40">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      Excelente consistência!
                    </p>
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                      Você está registrando suas refeições por {weeklyStats.streak} dias seguidos. Continue assim!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {goalProgress && goalProgress.exceeded > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/40">
                    <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Atenção às metas
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      {goalProgress.exceeded} {goalProgress.exceeded === 1 ? 'meta está' : 'metas estão'} acima do planejado hoje.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {weeklyStats.daysWithEntries === 7 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-sky-100 p-2 dark:bg-sky-900/40">
                    <Award className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                      Semana perfeita!
                    </p>
                    <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
                      Você registrou suas refeições todos os dias esta semana. Parabéns!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {favoriteRecipesList.length > 0 && averageCalories < 500 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-rose-100 p-2 dark:bg-rose-900/40">
                    <Heart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                      Receitas leves
                    </p>
                    <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                      Suas receitas favoritas têm em média {averageCalories.toFixed(0)} calorias. Ótimo para uma alimentação equilibrada!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Favorite Recipes */}
      {favoriteRecipesList.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Suas Receitas Favoritas
            </h3>
            <Link
              to="/?filter=favorites"
              className="flex items-center gap-1 text-sm font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteRecipesList.slice(0, 6).map((recipe) => (
              <Link
                key={recipe.id}
                to={`/receita/${recipe.id}`}
                className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 dark:bg-slate-900/90">
                    <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {recipe.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {recipe.category}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      {recipe.nutritionFacts.calories} kcal
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {recipe.prepTime}min
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {todayEntries.length === 0 && weeklyStats.totalEntries === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Utensils className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Comece a registrar suas refeições
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Adicione suas refeições ao diário para acompanhar seu progresso nutricional e alcançar suas metas.
          </p>
          <Link
            to="/perfil?tab=nutrition"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Registrar primeira refeição
          </Link>
        </div>
      )}
    </div>
  );
}
