import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { usePremiumStore } from '../../store/premium';
import { useTranslation } from '../../hooks/useTranslation';
import { returnToAdmin } from '../../services/admin';

/** Faixa fixa enquanto o administrador está numa conta demo do Laboratório. */
export function DemoBanner() {
  const user = useAuthStore((s) => s.user);
  const isDemo = usePremiumStore((s) => s.isDemo);
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

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-violet-600 px-4 py-2 text-sm text-white">
      <FlaskConical className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{t.adminPanel.demoBanner.replace('{name}', user.name)}</span>
      <button type="button" onClick={back} disabled={busy} className="flex-shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-60">
        {t.adminPanel.backToAdmin}
      </button>
    </div>
  );
}
