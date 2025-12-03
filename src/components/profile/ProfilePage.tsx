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
    'Veja suas informações pessoais, metas e atividades dentro da plataforma.';

  const isClient = user?.type === 'Client';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        {onBackToRecipes && (
          <button
            onClick={onBackToRecipes}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{BackToRecipes}</span>
          </button>
        )}

        {user && (
          <span className="ml-auto inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            {isClient ? t.profile.client : t.profile.nutricionist}
          </span>
        )}
      </div>

      {/* Header de página */}
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
          {profileTitle}
        </h1>
        <p className="max-w-2xl text-sm sm:text-base text-slate-500 dark:text-slate-400">
          {profileSubtitle}
        </p>
      </header>

      {/* Conteúdo principal */}
      <div className="space-y-10">
        {/* Card principal de perfil */}
        <ProfileCard />

        {/* Dashboard + abas */}
        <section className="space-y-8">
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50 sm:text-xl">
              {isClient
                ? t.profile?.overviewClient || 'Resumo da sua jornada'
                : t.profile?.overviewNutritionist || 'Resumo da sua atuação'}
            </h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              {isClient
                ? t.profile?.overviewClientDescription ||
                  'Acompanhe seus favoritos, metas e o impacto das suas escolhas no dia a dia.'
                : t.profile?.overviewNutritionistDescription ||
                  'Veja o desempenho das suas receitas, avaliações dos clientes e sua presença na plataforma.'}
            </p>

            {isClient ? <ClientDashboard /> : <NutritionistDashboard />}
          </div>

          {/* Abas (Receitas, Favoritos, Metas) */}
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
            <ProfileTabs />
          </div>
        </section>
      </div>
    </div>
  );
}
