import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Repeat } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { usePremiumStore } from '../../store/premium';
import { useTranslation } from '../../hooks/useTranslation';
import { returnToAdmin } from '../../services/admin';
import { switchDemoRole } from '../../services/demo';

/** Faixa fixa numa conta demo: Laboratório do administrador ou demonstração pública (/demo). */
export function DemoBanner() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const isDemo = usePremiumStore((s) => s.isDemo);
  const isVisitor = usePremiumStore((s) => s.isVisitor);
  const t = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Em toda conta demo (não só com a sessão do admin guardada): sem ela, o botão sai e leva ao login,
  // em vez de deixar o admin preso na conta demo.
  if (!user || !isDemo) return null;

  const back = async () => {
    setBusy(true);
    const ok = await returnToAdmin();
    setBusy(false);
    navigate(ok ? '/admin?tab=lab' : '/login');
  };

  const pill = 'flex-shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-60';

  if (isVisitor) {
    const nutritionist = user.type === 'Nutritionist';
    const switchRole = async () => {
      setBusy(true);
      try {
        await switchDemoRole();
        navigate('/perfil');
      } catch {
        // Par vencido (24 h): volta para a página da demonstração começar outro.
        await signOut();
        navigate('/demo');
      } finally {
        setBusy(false);
      }
    };
    const leave = async () => {
      await signOut();
      navigate('/demo');
    };
    return (
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-2 bg-violet-600 px-4 py-2 text-sm text-white">
        <FlaskConical className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{t.demo.banner.replace('{role}', nutritionist ? t.demo.roleNutritionist : t.demo.rolePatient)}</span>
        <button type="button" onClick={switchRole} disabled={busy} className={`${pill} inline-flex items-center gap-1`}>
          <Repeat className="h-3.5 w-3.5" />
          {nutritionist ? t.demo.switchToPatient : t.demo.switchToNutritionist}
        </button>
        <button type="button" onClick={leave} disabled={busy} className="flex-shrink-0 rounded-full border border-white/60 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60">
          {t.demo.leave}
        </button>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-violet-600 px-4 py-2 text-sm text-white">
      <FlaskConical className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{t.adminPanel.demoBanner.replace('{name}', user.name)}</span>
      <button type="button" onClick={back} disabled={busy} className={pill}>
        {t.adminPanel.backToAdmin}
      </button>
    </div>
  );
}
