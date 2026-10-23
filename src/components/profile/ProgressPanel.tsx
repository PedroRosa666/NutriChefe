import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, Circle, Crown, Flame, Lock, Target } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useHealthProfileStore } from '../../store/health-profile';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useOwnPremium } from '../../store/premium';
import { achievementsFor, weeklyChallenges, type Progress } from '../../lib/achievements';
import { getMyProgress } from '../../services/progress';
import { listPlans } from '../../services/care';
import { useAuthStore } from '../../store/auth';
import { cn } from '../../lib/utils';
import { appLocale } from '../../lib/format';
import { useToday } from '../../hooks/useToday';

/** Sequência, conquistas (todos) e desafios da semana (Premium) no painel do cliente. */
export function ProgressPanel() {
  const t = useTranslation();
  const c = t.clientPremium;
  const userId = useAuthStore((s) => s.user?.id);
  const goal = useHealthProfileStore((s) => s.profile.goal);
  // Recalcula quando o diário muda (novo registro no mesmo dia).
  const entriesCount = useNutritionTrackingStore((s) => s.entries.length);
  // Na virada do dia (e da semana, na segunda) a sequência e os desafios mudam.
  const today = useToday();
  const premium = useOwnPremium();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getMyProgress()
      .then(setProgress)
      .catch((error) => console.error('Error loading progress:', error));
  }, [entriesCount, today]);

  useEffect(() => {
    if (!userId) return;
    listPlans(userId)
      .then((plans) => setHasPlan(plans.length > 0))
      .catch(() => setHasPlan(false));
  }, [userId]);

  if (!progress) return null;

  const achievements = achievementsFor(progress, goal);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  // Primeiro as conquistadas; das que faltam, as mais perto de sair.
  const ordered = [...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.value / b.target - a.value / a.target);
  const visible = showAll ? ordered : ordered.slice(0, 6);
  const challenges = weeklyChallenges(progress, hasPlan);
  const allDone = challenges.every((ch) => ch.done);
  // Período dos desafios (segunda a domingo), para não parecerem metas do dia.
  const weekStart = progress.week.start ? new Date(`${progress.week.start}T12:00:00`) : null;
  const weekEnd = weekStart ? new Date(weekStart.getTime() + 6 * 86400000) : null;
  const short = (d: Date) => d.toLocaleDateString(appLocale(), { day: '2-digit', month: '2-digit' });
  // Dias que ainda contam, com hoje (domingo = 1: último dia).
  const daysLeft = weekEnd ? Math.round((weekEnd.getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000) + 1 : null;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Award className="h-4 w-4 text-emerald-600" />
            {c.progressTitle}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {c.unlocked.replace('{n}', String(unlocked)).replace('{total}', String(achievements.length))}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-orange-50 p-3 dark:bg-orange-900/20">
          <Flame className={cn('h-8 w-8 flex-shrink-0', progress.streak ? 'text-orange-500' : 'text-slate-300 dark:text-slate-600')} />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              {progress.streak ? c.streak.replace('{n}', String(progress.streak)) : c.streakZero}
            </p>
            {progress.best_streak > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{c.best.replace('{n}', String(progress.best_streak))}</p>}
          </div>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((a) => {
            const label = c.achievements[a.key];
            return (
              <li
                key={a.key}
                className={cn(
                  'rounded-xl border p-2.5',
                  a.unlocked
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
                )}
              >
                <p className={cn('flex items-center gap-1 text-sm font-semibold', a.unlocked ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-500 dark:text-slate-400')}>
                  {a.unlocked ? <Award className="h-4 w-4 flex-shrink-0" /> : <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
                  <span className="truncate">{label.title}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label.text}</p>
                {!a.unlocked && a.target > 1 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((a.value / a.target) * 100)}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {achievements.length > 6 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            {showAll ? c.showLess : t.profile.viewAll}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Target className="h-4 w-4 text-amber-500" />
          {c.challengesTitle}
        </h3>
        {weekStart && weekEnd && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {c.challengesHint.replace('{from}', short(weekStart)).replace('{to}', short(weekEnd))}
            {daysLeft !== null && daysLeft >= 1 && (
              <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">
                · {daysLeft === 1 ? c.challengesLastDay : c.challengesDaysLeft.replace('{n}', String(daysLeft))}
              </span>
            )}
          </p>
        )}

        <div className="relative mt-3">
          <ul className={cn('space-y-2.5', !premium && 'pointer-events-none select-none blur-[3px]')} aria-hidden={!premium}>
            {challenges.map((ch) => (
              <li key={ch.key}>
                <div className="flex items-center gap-2 text-sm">
                  {ch.done ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" />}
                  <span className={cn('flex-1', ch.done ? 'text-slate-500 line-through dark:text-slate-400' : 'text-slate-800 dark:text-slate-100')}>
                    {c.challenges[ch.key].replace('{t}', String(ch.target))}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {ch.value}/{ch.target}
                  </span>
                </div>
                <div className="ml-6 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={cn('h-full rounded-full', ch.done ? 'bg-emerald-500' : 'bg-amber-400')} style={{ width: `${Math.round((ch.value / ch.target) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {premium && allDone && <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">{c.allDone}</p>}
          {!premium && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/70 p-4 text-center dark:bg-slate-900/70">
              <p className="text-sm text-slate-700 dark:text-slate-200">{c.challengesLocked}</p>
              <Link to="/mentoria-ia" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-400">
                <Crown className="h-4 w-4" />
                {c.seePremium}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
