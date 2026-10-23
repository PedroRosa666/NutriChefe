import { Link } from 'react-router-dom';
import { Mail, ChefHat, Crown, CalendarDays, ExternalLink, User as UserIcon, BadgeCheck, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useSubscriptionStore } from '../../store/subscription';
import { useSettingsStore } from '../../store/settings';
import { useTranslation } from '../../hooks/useTranslation';
import { AvatarUpload } from '../common/AvatarUpload';
import { usePremiumStore } from '../../store/premium';
import { cn } from '../../lib/utils';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** Tipo de conta e plano, igual no cartão e na faixa compacta. */
function useAccountBadge() {
  const user = useAuthStore((s) => s.user);
  const { isPremium } = useSubscriptionStore();
  const nutritionistPro = usePremiumStore((s) => s.nutritionistPro);
  const t = useTranslation();
  const isNutritionist = user?.type === 'Nutritionist';
  const premium = isNutritionist ? nutritionistPro : isPremium();

  const badge = isNutritionist ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
      <ChefHat className="h-3.5 w-3.5" />
      {premium ? t.nutritionistPremium.badge : t.profile.nutricionist}
    </span>
  ) : premium ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      <Crown className="h-3.5 w-3.5" />
      {t.profile.clientPremium}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <UserIcon className="h-3.5 w-3.5" />
      {t.profile.client}
    </span>
  );
  return { badge, premium, isNutritionist };
}

/** Cabeçalho do perfil (Visão geral e Conta): identidade, plano e atalhos do perfil. */
export function ProfileCard() {
  const { user } = useAuthStore();
  const { language } = useSettingsStore();
  const t = useTranslation();
  const { badge, premium, isNutritionist } = useAccountBadge();

  if (!user) return null;

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative h-20 overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 sm:h-28">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-28 w-28 rounded-full bg-white/10" />
      </div>
      <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6 sm:pb-6">
        <div className="-mt-12 flex-shrink-0 self-start sm:-mt-14">
          <AvatarUpload currentAvatarUrl={user.avatar_url} size="xl" editable />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              {user.name || t.recipe.authorFallbackName}
            </h2>
            {badge}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{user.email}</span>
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4" />
              {t.profile.viewPublicProfile}
            </Link>
          )}
          {!premium && (
            <Link
              to="/mentoria-ia"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400"
            >
              <Crown className="h-4 w-4" />
              {t.profile.upgradePremium}
            </Link>
          )}
          {premium && !isNutritionist && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <BadgeCheck className="h-4 w-4" />
              {t.profile.clientPremium}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Faixa compacta nas outras abas: quem está logado, sem empurrar o conteúdo para baixo. */
export function ProfileStrip() {
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const { badge } = useAccountBadge();
  if (!user) return null;
  const name = user.name || t.recipe.authorFallbackName;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
        {initials(name) || <UserIcon className="h-5 w-5" />}
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900 dark:text-white">{name}</p>
        <div className="mt-0.5">{badge}</div>
      </div>
      <Link
        to="/perfil?tab=account"
        aria-label={t.profileUi.editProfile}
        title={t.profileUi.editProfile}
        className={cn('rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-slate-800')}
      >
        <Settings className="h-5 w-5" />
      </Link>
    </div>
  );
}
