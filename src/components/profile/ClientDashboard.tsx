import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Crown, ArrowRight, HeartPulse, Bot, BellRing, Stethoscope, UtensilsCrossed, CalendarRange, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { toISODate, sumEntries, useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useHealthProfileStore } from '../../store/health-profile';
import { useSubscriptionStore } from '../../store/subscription';
import { useTranslation } from '../../hooks/useTranslation';
import { bmi } from '../../lib/nutrition-calculator';
import { DashboardHero, firstNameOf, ProgressRing, useGreeting } from './DashboardHero';
import { WeeklyCaloriesChart } from '../nutrition/WeeklyCaloriesChart';
import { MyNutritionistCard } from '../care/MyNutritionistCard';
import { WeeklyReport } from './WeeklyReport';
import { UpcomingAppointments } from '../care/Appointments';
import { ProgressPanel } from './ProgressPanel';
import { SelfReportCard } from './SelfReportCard';

export function ClientDashboard() {
  const { user } = useAuthStore();
  const { recipes, favoriteRecipes } = useRecipesStore();
  const { goals, activeGoals, setBy } = useNutritionGoalsStore();
  const { entries } = useNutritionTrackingStore();
  const { profile: health } = useHealthProfileStore();
  const { isPremium } = useSubscriptionStore();
  const t = useTranslation();
  const greeting = useGreeting();

  const today = toISODate(new Date());
  const todayTotals = useMemo(() => sumEntries(entries.filter((e) => e.date === today)), [entries, today]);
  const daysLogged30 = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const min = toISODate(since);
    return new Set(entries.filter((e) => e.date >= min).map((e) => e.date)).size;
  }, [entries]);

  if (!user || user.type !== 'Client') return null;

  const favoriteRecipesList = recipes.filter((recipe) => favoriteRecipes.includes(recipe.id));
  const isPremiumUser = isPremium();
  const currentBmi = health.height_cm && health.weight_kg ? bmi(health.height_cm, health.weight_kg) : null;
  const healthIncomplete = !health.height_cm || !health.weight_kg || !health.goal || !health.activity_level;
  const goalLabels = t.profile.nutritionGoalsnames;
  const categoryLabel = (key: string) => t.categories[key as keyof typeof t.categories] ?? key;
  const caloriePct = goals.calories > 0 ? Math.round((todayTotals.calories / goals.calories) * 100) : 0;
  const kcalLeft = Math.round(goals.calories - todayTotals.calories);
  const firstName = firstNameOf(user.name, t.recipe.authorFallbackName);

  // Lembrete a partir das 11h, se nada foi registrado hoje.
  const showReminder = new Date().getHours() >= 11 && !entries.some((e) => e.date === today);

  return (
    <div className="space-y-6">
      <DashboardHero
        title={`${greeting}, ${firstName}!`}
        subtitle={t.profileUi.todayHint}
        aside={
          <ProgressRing value={todayTotals.calories} max={goals.calories}>
            <span className="text-xl font-bold leading-none">{Math.round(todayTotals.calories)}</span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-emerald-50">kcal</span>
          </ProgressRing>
        }
        stats={[
          {
            label: t.profileUi.caloriesToday,
            value: goals.calories > 0 ? `${caloriePct}%` : '—',
            hint: goals.calories <= 0
              ? t.profileUi.noGoal
              : kcalLeft >= 0
                ? t.profileUi.kcalLeft.replace('{n}', String(kcalLeft))
                : t.profileUi.kcalOver.replace('{n}', String(-kcalLeft)),
          },
          {
            label: t.health.currentWeight,
            value: health.weight_kg ? `${health.weight_kg} kg` : '—',
            hint: currentBmi ? `${t.health.bmi}: ${currentBmi}` : t.health.notInformed,
          },
          {
            label: t.profile.favorites,
            value: String(favoriteRecipesList.length),
            hint: `${daysLogged30} ${daysLogged30 === 1 ? t.profile.dayLoggedLast30 : t.profile.daysLoggedLast30}`,
          },
        ]}
        actions={[
          { to: '/perfil?tab=nutrition', label: t.profileUi.logMeal, icon: UtensilsCrossed },
          { to: '/perfil?tab=plan', label: t.profileUi.todayPlan, icon: CalendarRange },
          { to: '/perfil?tab=shopping', label: t.profileUi.shopping, icon: ShoppingCart },
          { to: '/perfil?tab=health', label: t.profileUi.logWeight, icon: Scale },
        ]}
      />

      <UpcomingAppointments />

      {/* Avisos que levam à próxima ação */}
      {showReminder && (
        <Link
          to="/perfil?tab=nutrition"
          className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30"
        >
          <BellRing className="h-6 w-6 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{t.report.reminderTitle}</p>
            <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">{t.report.reminderText}</p>
          </div>
          <span className="hidden text-sm font-semibold text-emerald-700 sm:inline dark:text-emerald-300">{t.report.reminderAction}</span>
          <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </Link>
      )}

      {healthIncomplete && (
        <Link
          to="/perfil?tab=health"
          className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 transition hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-900/20 dark:hover:bg-sky-900/30"
        >
          <HeartPulse className="h-6 w-6 flex-shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">{t.health.completeTitle}</p>
            <p className="text-sm text-sky-800/80 dark:text-sky-200/80">{t.health.completeDescription}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        </Link>
      )}


      {/* Progresso do dia */}
      {activeGoals.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t.profile.todayProgress}
              </h3>
              {setBy && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {t.care.setBy}
                </p>
              )}
            </div>
            <Link
              to="/perfil?tab=nutrition"
              className="whitespace-nowrap text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {t.profile.viewDiaryAndGoals}
            </Link>
          </div>

          {/* Uma linha por meta: nome, quanto já foi e a barra (vermelha se passou de 110%). */}
          <ul className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((key) => {
              if (!activeGoals.includes(key)) return null;
              const goal = goals[key] ?? 0;
              const value = todayTotals[key] ?? 0;
              const pct = goal > 0 ? value / goal : 0;
              const unit = key === 'calories' ? 'kcal' : 'g';
              return (
                <li key={key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-900 dark:text-white">{goalLabels[key]}</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">{value.toFixed(0)}</span> / {goal.toFixed(0)} {unit}
                      <span className={`ml-2 text-xs font-semibold ${pct > 1.1 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {Math.round(pct * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${pct > 1.1 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ProgressPanel />

      <WeeklyReport />

      <SelfReportCard />

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <WeeklyCaloriesChart entries={entries} goal={goals.calories} />
      </section>

      <MyNutritionistCard />

      {!isPremiumUser && (
        <Link
          to="/mentoria-ia"
          className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 transition hover:from-amber-100 dark:border-amber-800/40 dark:from-amber-900/20 dark:to-orange-900/20"
        >
          <Bot className="h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t.profile.premiumCtaTitle}</p>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80">{t.profile.premiumCtaDescription}</p>
          </div>
          <Crown className="h-5 w-5 text-amber-500" />
        </Link>
      )}

      {/* Favoritos recentes */}
      {favoriteRecipesList.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.profile.recentFavorites}
            </h3>
            <Link
              to="/perfil?tab=favorites"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              {t.profile.viewAll}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favoriteRecipesList.slice(0, 3).map((recipe) => (
              <Link
                key={recipe.id}
                to={`/receita/${recipe.id}`}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <img
                  src={recipe.image}
                  alt=""
                  className="h-16 w-16 flex-shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-gray-700"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{recipe.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{categoryLabel(recipe.category)}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {recipe.rating > 0 && <span>★ {recipe.rating.toFixed(1)}</span>}
                    <span>{recipe.prepTime} min</span>
                    <span>{Math.round(recipe.nutritionFacts.calories)} kcal</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
