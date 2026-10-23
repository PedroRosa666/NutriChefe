import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, MessageCircle, Users } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { appLocale } from '../../lib/format';
import { listMyPatients, type CareLink } from '../../services/care';
import { listThreads, type ThreadSummary } from '../../services/messages';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { LoadError } from '../common/LoadError';
import { Avatar } from './Avatar';
import { ChatThread } from './ChatThread';
import { cn } from '../../lib/utils';

interface Row {
  link: CareLink;
  thread?: ThreadSummary;
}

/** Hora para hoje, data para os outros dias. */
function when(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' });
}

/**
 * Caixa de mensagens do nutricionista: todas as conversas, não lidas primeiro.
 * A conversa aberta fica na URL (?com=<paciente>), então o voltar do celular volta para a lista.
 */
export function NutritionistInbox() {
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const m = t.messages;
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('com');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setFailed(false);
    Promise.all([listMyPatients(user.id), listThreads(user.id)])
      .then(([links, threads]) => {
        const byClient = new Map(threads.map((th) => [th.clientId, th]));
        const list = links
          .filter((l) => l.status === 'active')
          .map((link) => ({ link, thread: byClient.get(link.person.id) }))
          .sort((a, b) => {
            const unread = (b.thread?.unread ?? 0) - (a.thread?.unread ?? 0);
            if (unread) return unread;
            return (b.thread?.last.created_at ?? '').localeCompare(a.thread?.last.created_at ?? '');
          });
        setRows(list);
      })
      .catch((error) => {
        console.error('Error loading conversations:', error);
        setFailed(true);
      });
  }, [user]);

  // Recarrega ao voltar da conversa: a lida some do topo e a última mensagem atualiza.
  useEffect(() => {
    if (!openId) load();
  }, [load, openId]);

  const open = (clientId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (clientId) next.set('com', clientId);
    else next.delete('com');
    setSearchParams(next);
  };

  if (!user) return null;

  const current = rows?.find((r) => r.link.person.id === openId);
  if (openId) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => open(null)}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {m.allConversations}
        </button>
        <ChatThread
          nutritionistId={user.id}
          clientId={openId}
          otherName={current?.link.person.full_name ?? ''}
          tall
          action={
            <Link
              to={`/perfil?tab=patients&paciente=${openId}`}
              className="ml-auto flex-shrink-0 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {m.openPatient}
            </Link>
          }
        />
      </div>
    );
  }

  if (failed) return <LoadError onRetry={load} />;
  if (rows === null) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
        <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{m.noPatients}</p>
        <Link to="/perfil?tab=patients" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
          {t.profileUi.invitePatient}
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {rows.map(({ link, thread }) => {
        const unread = thread?.unread ?? 0;
        const mine = thread?.last.sender_id === user.id;
        return (
          <li key={link.id}>
            <button
              type="button"
              onClick={() => open(link.person.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Avatar name={link.person.full_name} url={link.person.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className={cn('min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-white', unread ? 'font-bold' : 'font-semibold')}>
                    {link.person.full_name || t.recipe.authorFallbackName}
                  </p>
                  {thread && <span className="flex-shrink-0 text-xs text-slate-400">{when(thread.last.created_at)}</span>}
                </div>
                <p className={cn('truncate text-sm', unread ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400')}>
                  {thread ? `${mine ? m.you : ''}${thread.last.body}` : m.startChat}
                </p>
              </div>
              {unread > 0 ? (
                <span className="min-w-[20px] rounded-full bg-emerald-600 px-1.5 text-center text-xs font-bold leading-5 text-white">{unread > 9 ? '9+' : unread}</span>
              ) : thread ? (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              ) : (
                <MessageCircle className="h-4 w-4 flex-shrink-0 text-slate-300" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
