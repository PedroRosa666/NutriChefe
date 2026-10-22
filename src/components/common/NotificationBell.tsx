import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, Bell, CalendarRange, Target, UserMinus, UserPlus, X } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useSettingsStore } from '../../store/settings';
import { useNotificationsStore } from '../../store/notifications';
import { useTranslation, type Translations } from '../../hooks/useTranslation';
import { translations } from '../../lib/i18n/translations';
import { notificationTarget, type AppNotification } from '../../services/notifications';
import { cn } from '../../lib/utils';

const ICONS = {
  swap_requested: ArrowLeftRight,
  swap_answered: ArrowLeftRight,
  patient_joined: UserPlus,
  link_ended: UserMinus,
  plan_updated: CalendarRange,
  goals_updated: Target,
} as const;

/** Texto do aviso no idioma atual. */
export function notificationText(n: AppNotification, t: Translations): string {
  const s = t.notifications;
  // O rótulo do item vem como "Nome — quantidade": no aviso basta o nome.
  const item = (n.data.item ?? '').split(' — ')[0];
  const template = (() => {
    switch (n.kind) {
      case 'swap_requested':
        return s.swapRequested;
      case 'swap_answered':
        if (n.data.status === 'approved') return s.swapApproved;
        return n.data.offered ? s.swapRejectedOffered : s.swapRejected;
      case 'patient_joined':
        return s.patientJoined;
      case 'link_ended':
        return s.linkEnded;
      case 'plan_updated':
        return n.data.new ? s.planCreated : s.planUpdated;
      case 'goals_updated':
        return s.goalsUpdated;
    }
  })();
  return template
    .replace('{name}', n.data.name || s.someone)
    .replace('{item}', item)
    .replace('{title}', n.data.title ?? '');
}

function timeAgo(iso: string, locale: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}

/** Liga os avisos do usuário logado (Realtime) em qualquer página; aviso novo vira toast. Usar uma vez, no layout. */
export function useLiveNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  const { showToast } = useToastStore();
  const { start, stop } = useNotificationsStore();

  useEffect(() => {
    if (!userId) {
      stop();
      return;
    }
    // O texto do toast usa o idioma do momento em que o aviso chega.
    start(userId, (n) => {
      const language = useSettingsStore.getState().language;
      showToast(notificationText(n, translations[language]), 'info');
    });
  }, [userId, start, stop, showToast]);
}

interface NotificationBellProps {
  /** Botão redondo flutuante (páginas sem o cabeçalho). */
  floating?: boolean;
}

/** Sino com os avisos do usuário logado. */
export function NotificationBell({ floating = false }: NotificationBellProps) {
  const user = useAuthStore((s) => s.user);
  const language = useSettingsStore((s) => s.language);
  const t = useTranslation();
  const navigate = useNavigate();
  const { items, markAllRead, markRead, remove } = useNotificationsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const unread = items.filter((i) => !i.read_at).length;
  const locale = language === 'pt' ? 'pt-BR' : 'en';

  const openItem = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    navigate(notificationTarget(n));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-2 text-gray-600 dark:text-gray-300',
          floating
            ? 'rounded-full border border-white/60 bg-white/80 shadow-md backdrop-blur-md hover:bg-white dark:border-white/10 dark:bg-slate-900/80 dark:hover:bg-slate-900'
            : 'rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
        aria-label={unread ? `${t.notifications.open} (${unread})` : t.notifications.open}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 top-16 z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-96 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="font-semibold text-slate-900 dark:text-white">{t.notifications.title}</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                >
                  {t.notifications.markAllRead}
                </button>
              )}
            </div>
            {!items.length ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{t.notifications.empty}</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {items.map((n) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  return (
                    <li key={n.id} className={cn('group flex items-start gap-3 px-4 py-3', !n.read_at && 'bg-emerald-50/60 dark:bg-emerald-900/10')}>
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <button type="button" onClick={() => openItem(n)} className="min-w-0 flex-1 text-left">
                        <p className={cn('text-sm text-slate-700 dark:text-slate-200', !n.read_at && 'font-semibold text-slate-900 dark:text-white')}>
                          {notificationText(n, t)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{timeAgo(n.created_at, locale)}</p>
                      </button>
                      {!n.read_at && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" aria-hidden />}
                      <button
                        type="button"
                        onClick={() => remove(n.id)}
                        className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        aria-label={t.notifications.remove}
                        title={t.notifications.remove}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
