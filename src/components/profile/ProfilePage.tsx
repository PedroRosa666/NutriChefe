import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRecipesStore } from '../../store/recipes';
import { ArrowLeft, LogIn } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import { ProfileTabs } from './ProfileTabs';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';

interface ProfilePageProps {
  onBackToRecipes?: () => void;
}

export function ProfilePage({ onBackToRecipes }: ProfilePageProps) {
  const { user } = useAuthStore();
  const t = useTranslation();

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
        <Link to="/login" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          {t.common.signIn}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {onBackToRecipes && (
        <button
          onClick={onBackToRecipes}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.buttons.BackToRecipes}</span>
        </button>
      )}

      <ProfileCard />
      <ProfileTabs />
    </div>
  );
}
