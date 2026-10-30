import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useRecipesStore } from '../../store/recipes';
import { CalendarCheck, LogIn, MessageCircle, NotebookPen, Stethoscope, UserPlus } from 'lucide-react';
import { ProfileCard, ProfileStrip } from './ProfileCard';
import { ProfileTabs } from './ProfileTabs';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { sectionOfTab } from '../../lib/app-sections';
import { useAppRole } from '../../hooks/useAppNav';

export function ProfilePage() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const role = useAppRole();

  // As receitas do próprio usuário (painel, conteúdo, avaliações recebidas).
  useEffect(() => {
    if (user) useRecipesStore.getState().loadMine();
  }, [user]);

  if (!user) {
    // Link de convite: quem chega por ele quase sempre ainda não tem conta.
    return <GuestGate invited={searchParams.has('convite')} next={encodeURIComponent(location.pathname + location.search)} />;
  }

  // Na seção Perfil, quem está logado aparece no topo (o cartão completo só na aba Conta).
  // Nas outras seções o conteúdo começa logo abaixo do cabeçalho.
  const section = sectionOfTab(role, tab).key;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      {section === 'profile' && (tab === 'account' || role === 'admin' ? <ProfileCard /> : <ProfileStrip />)}
      <ProfileTabs />
    </div>
  );
}

const PERK_ICONS = [NotebookPen, CalendarCheck, MessageCircle];

/**
 * Perfil sem login: o que a conta guarda e as duas portas (entrar ou criar conta). Quem chega
 * por convite do nutricionista vê o cadastro como ação principal; os demais, o Entrar.
 */
function GuestGate({ invited, next }: { invited: boolean; next: string }) {
  const t = useTranslation();
  const u = t.profileUi;
  const primary =
    'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600';
  const secondary =
    'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
  const signUp = (
    <Link key="up" to={`/login?modo=cadastro&next=${next}`} className={invited ? primary : secondary}>
      <UserPlus className="h-4 w-4" aria-hidden="true" />
      {t.common.signUp}
    </Link>
  );
  const signIn = (
    <Link key="in" to={`/login?next=${next}`} className={invited ? secondary : primary}>
      <LogIn className="h-4 w-4" aria-hidden="true" />
      {invited ? u.haveAccount : t.common.signIn}
    </Link>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <div className="grid overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-emerald-900/5 md:grid-cols-[1.1fr_1fr] dark:border-slate-800 dark:bg-slate-900">
        {/* Ações primeiro no celular; ao lado do painel verde a partir do tablet. */}
        <div className="order-1 flex flex-col justify-center gap-5 p-6 sm:p-8 md:order-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">NutriChef</span>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-900 dark:text-white">
              {invited ? u.invitedTitle : t.profile.loginRequired}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{invited ? u.invitedHint : u.guestHint}</p>
          </div>
          <div className="space-y-2.5">{invited ? [signUp, signIn] : [signIn, signUp]}</div>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">{u.guestFree}</p>
        </div>

        <div className="order-2 bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-700 p-6 text-white sm:p-8 md:order-1">
          <p className="text-xl font-bold leading-tight sm:text-2xl">{invited ? u.guestPanelTitleInvited : u.guestPanelTitle}</p>
          <ul className="mt-6 space-y-4">
            {u.guestPerks.map((perk, i) => {
              const Icon = PERK_ICONS[i] ?? NotebookPen;
              return (
                <li key={perk} className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="pt-1.5 text-sm leading-snug text-emerald-50">{perk}</span>
                </li>
              );
            })}
          </ul>
          {!invited && (
            <p className="mt-8 flex items-start gap-3 border-t border-white/20 pt-5 text-sm leading-snug text-emerald-50">
              <Stethoscope className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {u.guestPro}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
