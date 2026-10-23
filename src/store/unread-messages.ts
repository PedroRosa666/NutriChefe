import { create } from 'zustand';
import { countUnreadMessages } from '../services/messages';

interface UnreadMessagesState {
  count: number;
  refresh: (userId: string) => Promise<void>;
  reset: () => void;
}

/** Mensagens recebidas e ainda não lidas (paciente ou nutricionista), para o contador da navegação. */
export const useUnreadMessagesStore = create<UnreadMessagesState>((set) => ({
  count: 0,
  refresh: async (userId) => {
    try {
      set({ count: await countUnreadMessages(userId) });
    } catch (error) {
      console.error('Error counting unread messages:', error);
    }
  },
  reset: () => set({ count: 0 }),
}));
