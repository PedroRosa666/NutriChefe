import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { listMyNutritionists, type CareLink } from '../../services/care';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ChatThread } from './ChatThread';

/** Aba Mensagens do paciente: uma conversa com cada nutricionista que o acompanha. */
export function MessagesPanel() {
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const [links, setLinks] = useState<CareLink[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listMyNutritionists(user.id)
      .then(setLinks)
      .catch((error) => {
        console.error('Error loading nutritionists:', error);
        setLinks([]);
      });
  }, [user]);

  if (!user || links === null) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!links.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
        <MessageCircle className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.messages.noNutritionist}</p>
        <Link to="/perfil" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
          {t.messages.connectHint}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {links.map((l) => (
        <ChatThread key={l.id} nutritionistId={l.person.id} clientId={user.id} otherName={l.person.full_name ?? ''} />
      ))}
    </div>
  );
}
