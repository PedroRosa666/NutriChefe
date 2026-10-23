import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useRecipesStore } from '../../store/recipes';
import { LogIn, UserPlus } from 'lucide-react';
import { ProfileCard, ProfileStrip } from './ProfileCard';
import { ProfileTabs } from './ProfileTabs';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { sectionOfTab } from '../../lib/app-sections';

export function ProfilePage() {
  const { user } = useAuthStore();
  const t = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');

  // Acesso direto a /perfil: as receitas (minhas, favoritas, avaliações) ainda não foram carregadas.
  useEffect(() => {
    const { recipes, loading, fetchRecipes } = useRecipesStore.getState();
    if (!recipes.length && !loading) fetchRecipes();
  }, []);

  if (!user) {
    // Link de convite: quem chega por ele quase sempre ainda não tem conta.
    const invited = searchParams.has('convite');
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        {invited ? <UserPlus className="h-10 w-10 text-emerald-500" /> : <LogIn className="h-10 w-10 text-emerald-500" />}
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{invited ? t.profileUi.invitedTitle : t.profile.loginRequired}</h1>
        {invited && <p className="text-sm text-slate-600 dark:text-slate-400">{t.profileUi.invitedHint}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            to={`/login?modo=cadastro&next=${next}`}
            className={
              invited
                ? 'rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700'
                : 'rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }
          >
            {t.common.signUp}
          </Link>
          <Link
            to={`/login?next=${next}`}
            className={
              invited
                ? 'rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                : 'rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700'
            }
          >
            {invited ? t.profileUi.haveAccount : t.common.signIn}
          </Link>
        </div>
      </div>
    );
  }

  // Na seção Perfil, quem está logado aparece no topo (o cartão completo só na aba Conta).
  // Nas outras seções o conteúdo começa logo abaixo do cabeçalho.
  const section = sectionOfTab(user.type === 'Nutritionist', tab).key;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      {section === 'profile' && (tab === 'account' ? <ProfileCard /> : <ProfileStrip />)}
      <ProfileTabs />
    </div>
  );
}
