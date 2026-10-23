import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuthStore } from './auth';
import { useSettingsStore } from './settings';
import { useToastStore } from './toast';
import { translations } from '../lib/i18n/translations';
import type { Translations } from '../hooks/useTranslation';
import {
  deleteNotification,
  listNotifications,
  markNotificationsRead,
  subscribeNotifications,
  type AppNotification,
} from '../services/notifications';

interface NotificationsState {
  items: AppNotification[];
  userId: string | null;
  /** Chamado quando chega um aviso novo (o sino mostra um toast). */
  onArrive: ((n: AppNotification) => void) | null;
  start: (userId: string, onArrive: (n: AppNotification) => void) => void;
  stop: () => void;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

const sortByDate = (list: AppNotification[]) => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  userId: null,
  onArrive: null,

  start: (userId, onArrive) => {
    if (get().userId === userId) {
      set({ onArrive });
      return;
    }
    get().stop();
    set({ userId, onArrive, items: [] });
    listNotifications()
      .then((items) => get().userId === userId && set({ items }))
      .catch((error) => console.error('Error loading notifications:', error));
    unsubscribe = subscribeNotifications(userId, (n) => {
      const existing = get().items.find((i) => i.id === n.id);
      // Novo de verdade: não existia, ou existia já lido e voltou a ficar não lido (agrupado).
      const isNew = !n.read_at && (!existing || existing.read_at !== null || existing.created_at !== n.created_at);
      set({ items: sortByDate([n, ...get().items.filter((i) => i.id !== n.id)]).slice(0, 50) });
      if (isNew) get().onArrive?.(n);
    });
  },

  stop: () => {
    unsubscribe?.();
    unsubscribe = null;
    set({ userId: null, items: [], onArrive: null });
  },

  markAllRead: async () => {
    const ids = get().items.filter((i) => !i.read_at).map((i) => i.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    set({ items: get().items.map((i) => (i.read_at ? i : { ...i, read_at: now })) });
    await markNotificationsRead(ids).catch((error) => console.error('Error marking notifications:', error));
  },

  markRead: async (id) => {
    const now = new Date().toISOString();
    set({ items: get().items.map((i) => (i.id === id && !i.read_at ? { ...i, read_at: now } : i)) });
    await markNotificationsRead([id]).catch((error) => console.error('Error marking notification:', error));
  },

  remove: async (id) => {
    set({ items: get().items.filter((i) => i.id !== id) });
    await deleteNotification(id).catch((error) => console.error('Error deleting notification:', error));
  },
}));

/**
 * Muda sempre que chega um aviso que passa no filtro. Serve de dependência de efeito
 * para recarregar uma tela quando algo acontece do outro lado (ex.: troca respondida).
 */
export function useNotificationSignal(match: (n: AppNotification) => boolean): string {
  return useNotificationsStore((s) => {
    const hit = s.items.find(match);
    return hit ? `${hit.id}:${hit.created_at}` : '';
  });
}

const formatWhen = (iso: string) => {
  const locale = useSettingsStore.getState().language === 'pt' ? 'pt-BR' : 'en-US';
  return new Date(iso).toLocaleString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

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
      case 'message':
        return s.message;
      case 'appointment_scheduled':
        return n.data.rescheduled ? s.appointmentRescheduled : s.appointmentScheduled;
      case 'appointment_canceled':
        return s.appointmentCanceled;
      case 'appointment_reminder':
        return s.appointmentReminder;
      case 'verification_requested':
        return s.verificationRequested;
      case 'verification_reviewed':
        return n.data.approved ? s.verificationApproved : s.verificationRejected;
    }
  })();
  return template
    .replace('{name}', n.data.name || s.someone)
    .replace('{item}', item)
    .replace('{title}', n.data.title ?? '')
    .replace('{preview}', n.data.preview ?? '')
    .replace('{when}', n.data.starts_at ? formatWhen(n.data.starts_at) : '')
    .replace('{crn}', n.data.crn ?? '')
    .replace('{reason}', n.data.reason ?? '');
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
