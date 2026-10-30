import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';
import { useProfessionalProfile, professionalChecklist } from '../../hooks/useProfessionalProfile';
import { DashboardHero } from './DashboardHero';
import { useGreeting } from '../../hooks/useGreeting';
import { firstNameOf } from '../../lib/format';
import { usePremiumStore } from '../../store/premium';
import { useUnreadMessagesStore } from '../../store/unread-messages';
import { UpcomingAppointments } from '../care/Appointments';
import { CrnVerificationCard } from '../care/CrnVerificationCard';
import { AttentionPanel, usePatientsAttention } from '../care/AttentionPanel';
import { GettingStarted } from './GettingStarted';
import { getMyCrnStatus, type CrnStatus } from '../../services/verification';

/**
 * Painel do nutricionista: quem precisa de você e o que vem a seguir. O perfil público e as
 * receitas ficam em Perfil (NutritionistInsights), não aqui.
 */
export function NutritionistDashboard() {
  const { user } = useAuthStore();
  const recipesCount = useRecipesStore((s) => s.mine.length);
  const t = useTranslation();
  const userId = user?.id;
  const { profile, loading: profileLoading } = useProfessionalProfile(userId);
  // O perfil só aparece na lista de nutricionistas depois do CRN aprovado.
  const [crnStatus, setCrnStatus] = useState<CrnStatus | null>(null);
  useEffect(() => {
    if (!userId) return;
    getMyCrnStatus(userId)
      .then((r) => setCrnStatus(r.status))
      .catch((e) => console.error('Error loading CRN status:', e));
  }, [userId]);

  const { flagged, failed: attentionFailed, retry: retryAttention } = usePatientsAttention();
  const unread = useUnreadMessagesStore((s) => s.count);
  const greeting = useGreeting();
  const { nutritionistPro, activePatients, freePatientLimit, isVisitor } = usePremiumStore();

  // Hooks acima precisam rodar sempre, antes de qualquer retorno antecipado.
  if (!user || user.type !== 'Nutritionist') return null;
  const firstName = firstNameOf(user.name, t.recipe.authorFallbackName);

  const checklist = professionalChecklist(profile ? { ...profile, avatar_url: user.avatar_url ?? profile.avatar_url } : null);
  const completeness = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  // Enquanto carrega, blocos cinzas no lugar de "0".
  if (profileLoading || flagged === null) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHero
        title={`${greeting}, ${firstName}!`}
        subtitle={t.profileUi.nutritionistHint}
        stats={[
          {
            label: t.profileUi.needAttention,
            value: attentionFailed ? '—' : String(flagged.length),
            hint: !attentionFailed && activePatients > 0 && flagged.length === 0 ? t.profileUi.allCaughtUp : undefined,
            to: '/perfil?tab=patients&filtro=atencao',
          },
          { label: t.profileUi.unreadMessages, value: String(unread), to: '/perfil?tab=messages' },
          {
            to: '/perfil?tab=patients',
            label: t.profileUi.activePatients,
            value: String(activePatients),
            hint: nutritionistPro
              ? t.profileUi.unlimitedPatients
              : t.profileUi.patientsOfLimit.replace('{n}', String(activePatients)).replace('{max}', String(freePatientLimit)),
          },
        ]}
        // Pacientes e Mensagens já estão na navegação e nos números acima; fica só o convite.
        // Visitante da demonstração não convida.
        actions={isVisitor ? [] : [{ to: '/perfil?tab=patients&convidar=1', label: t.profileUi.invitePatient, icon: UserPlus }]}
      />
      <CrnVerificationCard />
      {/* Em tela larga, fila e consultas lado a lado: uma lista só na largura toda ficava esticada. */}
      {activePatients > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <AttentionPanel flagged={flagged} failed={attentionFailed} onRetry={retryAttention} hasPatients />
          <UpcomingAppointments />
        </div>
      ) : (
        <UpcomingAppointments />
      )}
      {crnStatus !== null && !isVisitor && (
        <GettingStarted
          userId={user.id}
          steps={[
            { key: 'crn', label: t.profileUi.stepCrn, hint: t.profileUi.stepCrnHint, done: crnStatus === 'approved' || crnStatus === 'pending', to: '/perfil' },
            { key: 'profile', label: t.profileUi.stepProfile, hint: t.profileUi.stepProfileHint, done: completeness >= 75, to: '/perfil?tab=professional' },
            { key: 'patient', label: t.profileUi.stepPatient, hint: t.profileUi.stepPatientHint, done: activePatients > 0, to: '/perfil?tab=patients&convidar=1' },
            { key: 'recipe', label: t.profileUi.stepRecipe, hint: t.profileUi.stepRecipeHint, done: recipesCount > 0, to: '/perfil?tab=recipes&nova=1' },
          ]}
        />
      )}
    </div>
  );
}
