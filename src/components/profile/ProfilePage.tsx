import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useRecipesStore } from '../../store/recipes';
import { ArrowLeft, LogIn } from 'lucide-react';
import { ProfileCard, ProfileStrip } from './ProfileCard';
import { ProfileTabs } from './ProfileTabs';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';

interface ProfilePageProps {
  onBackToRecipes?: () => void;
}

// O cartão grande só aparece onde ele é o assunto; nas outras abas fica uma faixa compacta,
// para o conteúdo (plano, diário, compras...) aparecer logo no topo do celular.
const FULL_CARD_TABS = [null, 'overview', 'account'];

export function ProfilePage({ onBackToRecipes }: ProfilePageProps) {
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
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <LogIn className="h-10 w-10 text-emerald-500" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t.profile.loginRequired}</h1>
        <Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          {t.common.signIn}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      {/* Espaço à direita para o sino flutuante */}
      {onBackToRecipes && (
        <div className="flex h-11 items-center pr-14">
          <button
            onClick={onBackToRecipes}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.buttons.BackToRecipes}</span>
          </button>
        </div>
      )}

      {FULL_CARD_TABS.includes(tab) ? <ProfileCard /> : <ProfileStrip />}
      <ProfileTabs />
    </div>
  );
}
