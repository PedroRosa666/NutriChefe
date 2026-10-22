import { create } from 'zustand';
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
