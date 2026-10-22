import { Link } from 'react-router-dom';
import { Mail, ChefHat, Crown, CalendarDays, ExternalLink, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useSubscriptionStore } from '../../store/subscription';
import { useSettingsStore } from '../../store/settings';
import { useTranslation } from '../../hooks/useTranslation';
import { AvatarUpload } from '../common/AvatarUpload';

/** Cabeçalho do perfil: identidade e plano. As métricas ficam na aba "Visão geral". */
export function ProfileCard() {
  const { user } = useAuthStore();
  const { isPremium } = useSubscriptionStore();
  const { language } = useSettingsStore();
  const t = useTranslation();

  if (!user) return null;

  const isNutritionist = user.type === 'Nutritionist';
  const isPremiumUser = !isNutritionist && isPremium();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-24 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 sm:h-28" />
      <div className="flex flex-col gap-4 px-4 pb-6 sm:flex-row sm:items-end sm:px-6">
        <div className="-mt-10 flex-shrink-0 self-start sm:-mt-12">
          <AvatarUpload currentAvatarUrl={user.avatar_url} size="xl" editable />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">
              {user.name || t.recipe.authorFallbackName}
            </h2>
            {isNutritionist ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                <ChefHat className="h-3.5 w-3.5" />
                {t.profile.nutricionist}
              </span>
            ) : isPremiumUser ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                <Crown className="h-3.5 w-3.5" />
                {t.profile.clientPremium}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <UserIcon className="h-3.5 w-3.5" />
                {t.profile.client}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {user.email}
            </span>
            {memberSince && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {t.profile.memberSince} {memberSince}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isNutritionist && (
            <Link
              to={`/nutricionista/${user.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4" />
              {t.profile.viewPublicProfile}
            </Link>
          )}
          {!isNutritionist && !isPremiumUser && (
            <Link
              to="/mentoria-ia"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Crown className="h-4 w-4" />
              {t.profile.upgradePremium}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
