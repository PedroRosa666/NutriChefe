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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400 sm:text-base">
          {profileSubtitle}
        </p>
      </header>

      {/* Conteúdo principal */}
      <div className="space-y-10">
        {/* Card principal de perfil */}
        <ProfileCard />

        {/* Dashboard + abas */}
        <section className="space-y-8">
          {/* Agora o dashboard cuida do próprio título "Resumo da sua atuação/jornada"
              e dos cards de métricas. Sem card extra aqui. */}
          {isClient ? <ClientDashboard /> : <NutritionistDashboard />}

          {/* Abas (Receitas, Favoritos, Metas) em um card separado */}
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
            <ProfileTabs />
          </div>
        </section>
      </div>
    </div>
  );
}
