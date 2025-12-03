import { ArrowLeft } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import { ProfileTabs } from './ProfileTabs';
import { ClientDashboard } from './ClientDashboard';
import { NutritionistDashboard } from './NutritionistDashboard';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';

interface ProfilePageProps {
  onBackToRecipes?: () => void;
}

export function ProfilePage({ onBackToRecipes }: ProfilePageProps) {
  const { user } = useAuthStore();
  const t = useTranslation();

  const BackToRecipes = t.buttons.BackToRecipes;
  const profileTitle = t.profile?.title || 'Meu perfil';
  const profileSubtitle =
    t.profile?.subtitle ||
    'Gerencie suas informações, objetivos e configurações da sua conta.';

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Topo: botão voltar + título */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        {onBackToRecipes && (
          <button
            onClick={onBackToRecipes}
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-emerald-600 hover:text-emerald-700 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>{BackToRecipes}</span>
          </button>
        )}

        <div className="sm:text-right">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            {profileTitle}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {profileSubtitle}
          </p>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="space-y-6 sm:space-y-7">
        <ProfileCard />

        <div className="rounded-2xl border border-gray-100 bg-white/80 px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80 sm:px-5 sm:py-5">
          {user?.type === 'Client' ? (
            <ClientDashboard />
          ) : (
            <NutritionistDashboard />
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white/80 px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80 sm:px-5 sm:py-5">
          <ProfileTabs />
        </div>
      </div>
    </div>
  );
}
